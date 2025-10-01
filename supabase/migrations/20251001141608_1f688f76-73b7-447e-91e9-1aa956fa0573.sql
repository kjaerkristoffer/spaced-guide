-- Update the card_type check constraint to include fill-blank
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_card_type_check;
ALTER TABLE cards ADD CONSTRAINT cards_card_type_check CHECK (card_type IN ('flashcard', 'quiz', 'fill-blank'));