-- pgvector similarity search function used by get-recommendations Edge Function
CREATE OR REPLACE FUNCTION public.find_similar_dishes(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  exclude_user_ids uuid[]
)
RETURNS TABLE (
  dish_name text,
  restaurant_name text,
  city text,
  state text,
  rating numeric,
  similarity float
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.dish_name,
    p.restaurant_name,
    p.city,
    p.state,
    dr.rating,
    (1 - (dr.embedding <=> query_embedding))::float AS similarity
  FROM public.dish_ratings dr
  JOIN public.posts p ON dr.post_id = p.id
  WHERE
    dr.embedding IS NOT NULL
    AND dr.user_id != ALL(exclude_user_ids)
    AND p.is_public = true
    AND (1 - (dr.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
