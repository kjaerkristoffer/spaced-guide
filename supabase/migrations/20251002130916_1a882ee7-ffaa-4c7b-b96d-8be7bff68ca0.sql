-- Add foreign key constraint with cascade delete for cards
ALTER TABLE public.cards 
DROP CONSTRAINT IF EXISTS cards_learning_path_id_fkey;

ALTER TABLE public.cards
ADD CONSTRAINT cards_learning_path_id_fkey 
FOREIGN KEY (learning_path_id) 
REFERENCES public.learning_paths(id) 
ON DELETE CASCADE;

-- Add foreign key constraint with cascade delete for user_progress
ALTER TABLE public.user_progress
DROP CONSTRAINT IF EXISTS user_progress_card_id_fkey;

ALTER TABLE public.user_progress
ADD CONSTRAINT user_progress_card_id_fkey
FOREIGN KEY (card_id)
REFERENCES public.cards(id)
ON DELETE CASCADE;