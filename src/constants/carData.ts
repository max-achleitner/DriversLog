export const CAR_MAKES_MODELS: Record<string, string[]> = {
  'Audi': [
    'A1 (S1)',
    'A3 (S3 / RS3)',
    'A4 (S4 / RS4)',
    'A5 (S5 / RS5)',
    'A6 (S6 / RS6)',
    'A7 (S7 / RS7)',
    'TT (TTS / TTRS)',
    'R8',
    'e-tron GT',
  ],
  'BMW': [
    '1er (M Coupé)',
    '2er (M2)',
    '3er (M3)',
    '4er (M4)',
    '5er (M5)',
    '6er',
    '7er',
    '8er',
    'Z3',
    'Z4',
    'Z8',
    'i8',
  ],
  'Volkswagen': [
    'Golf (GTI / R / R32)',
    'Scirocco',
    'Corrado',
    'Beetle',
    'Polo (GTI)',
    'Passat (R36 / CC)',
    'Arteon',
    'T-Roc (R)',
  ],
};

export const CAR_MAKES = Object.keys(CAR_MAKES_MODELS).sort();
