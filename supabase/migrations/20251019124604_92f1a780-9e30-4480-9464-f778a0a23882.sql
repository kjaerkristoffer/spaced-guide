-- Create mnemonics table for storing memory techniques
CREATE TABLE public.mnemonics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  learning_path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  highlighted_text TEXT NOT NULL,
  mnemonic_text TEXT NOT NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mnemonics ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own mnemonics" 
ON public.mnemonics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mnemonics" 
ON public.mnemonics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mnemonics" 
ON public.mnemonics 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mnemonics" 
ON public.mnemonics 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_mnemonics_updated_at
BEFORE UPDATE ON public.mnemonics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();