// The shape of a paper's game content. Hand-written for now; later an AI
// will generate files in this same format from any paper.

export interface Question {
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface Cutscene {
  title: string;
  speaker: string;
  pages: string[];
  practice?: Question;
}

export interface Boss {
  name: string;
  questions: Question[];
}

export interface World {
  id: string;
  name: string;
  section: string;
  cutscenes: Cutscene[];
  // Shown one at a time, each time the player stomps a bear.
  facts: string[];
  boss: Boss;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  subject: string;
  summary: string;
  intro: Cutscene;
  worlds: World[];
}
