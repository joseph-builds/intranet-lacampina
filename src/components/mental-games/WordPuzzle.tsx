import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Clock, Trophy, Star, RefreshCw, Shuffle, Lightbulb } from "lucide-react";

interface WordPuzzleProps {
  gameId: string;
  gameName: string;
  difficulty: number;
  onComplete: (score: number, durationSeconds: number) => void;
  onBack: () => void;
}

const WORD_BANKS: Record<number, string[]> = {
  1: ["CASA", "PERRO", "GATO", "SOL", "LUNA", "AGUA", "FUEGO", "PAN", "SAL", "MAR"],
  2: ["CAMINO", "ARBOL", "LIBRO", "CIELO", "PLAYA", "MONTE", "RUIDO", "SUENO", "DULCE", "FRUTA"],
  3: ["PROGRAMA", "ESTUDIAR", "CREATIVO", "NATURALEZA", "CONOCER", "VENTANA", "CAMINATA", "ESCUELA"],
  4: ["INTELIGENCIA", "CONOCIMIENTO", "DESCUBRIMIENTO", "APRENDIZAJE", "EDUCACION", "TECNOLOGIA", "EXPLORAR", "INVESTIGAR"],
  5: ["RAZONAMIENTO", "METACOGNICION", "NEUROPLASTICIDAD", "PENSAMIENTO", "COMPRENSION", "SIGNIFICADO", "ABSTRACCION", "LOGICA"],
};

function shuffleWord(word: string): string {
  const letters = word.split("");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join("");
}

function isValidShuffle(original: string, shuffled: string): boolean {
  return shuffled !== original;
}

const TOTAL_WORDS = 8;

export function WordPuzzle({ gameId, gameName, difficulty, onComplete, onBack }: WordPuzzleProps) {
  const [words, setWords] = useState<string[]>([]);
  const [scrambledWords, setScrambledWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [currentHint, setCurrentHint] = useState<string>("");
  const [showHint, setShowHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  const initWords = () => {
    const bank = WORD_BANKS[difficulty] || WORD_BANKS[1];
    const selected = [...bank].sort(() => Math.random() - 0.5).slice(0, TOTAL_WORDS);
    setWords(selected);

    const scrambled: string[] = [];
    selected.forEach((word) => {
      let shuffled: string;
      let attempts = 0;
      do {
        shuffled = shuffleWord(word);
        attempts++;
      } while (!isValidShuffle(word, shuffled) && attempts < 50);
      scrambled.push(shuffled);
    });
    setScrambledWords(scrambled);
  };

  useEffect(() => {
    initWords();
  }, [difficulty]);

  useEffect(() => {
    if (gameStarted && !gameFinished) {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, gameFinished]);

  useEffect(() => {
    if (gameStarted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameStarted, currentWordIndex]);

  const handleScramble = () => {
    if (!words[currentWordIndex]) return;
    let shuffled: string;
    let attempts = 0;
    do {
      shuffled = shuffleWord(words[currentWordIndex]);
      attempts++;
    } while (!isValidShuffle(words[currentWordIndex], shuffled) && attempts < 50);
    
    const newScrambled = [...scrambledWords];
    newScrambled[currentWordIndex] = shuffled;
    setScrambledWords(newScrambled);
  };

  const handleHint = () => {
    if (!words[currentWordIndex]) return;
    setHintsUsed((prev) => prev + 1);
    const word = words[currentWordIndex];
    const hintLength = Math.max(2, Math.floor(word.length / 3));
    const hint = word.slice(0, hintLength) + "_".repeat(word.length - hintLength);
    setCurrentHint(hint);
    setShowHint(true);
  };

  const handleSubmit = () => {
    if (!gameStarted) setGameStarted(true);
    if (gameFinished || feedback !== null) return;

    const normalizedAnswer = userAnswer.toUpperCase().trim();
    const correctWord = words[currentWordIndex];

    const isCorrect = normalizedAnswer === correctWord;

    let wordScore = 0;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      const timeBonus = Math.max(0, 20 - elapsedSeconds + currentWordIndex * 2);
      const hintPenalty = hintsUsed * 30;
      wordScore = Math.max(50, 150 + timeBonus - hintPenalty);
      setScore((prev) => prev + wordScore);
      setFeedback("correct");
    } else {
      setFeedback("wrong");
    }

    // Use the accumulated score for the final calculation
    const finalAccumulatedScore = score + wordScore;

    setTimeout(() => {
      setFeedback(null);
      setShowHint(false);
      setCurrentHint("");
      if (currentWordIndex + 1 >= TOTAL_WORDS) {
        setGameFinished(true);
        const finalTime = elapsedSeconds;
        setTimeout(() => {
          onComplete(finalAccumulatedScore, finalTime);
          setShowResult(true);
        }, 500);
      } else {
        setCurrentWordIndex((prev) => prev + 1);
        setUserAnswer("");
      }
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const resetGame = () => {
    initWords();
    setCurrentWordIndex(0);
    setUserAnswer("");
    setScore(0);
    setCorrectCount(0);
    setGameStarted(false);
    setGameFinished(false);
    setElapsedSeconds(0);
    setShowResult(false);
    setFeedback(null);
    setHintsUsed(0);
    setCurrentHint("");
    setShowHint(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (showResult) {
    const stars = score >= 800 ? 3 : score >= 500 ? 2 : 1;

    return (
      <Card className="bg-gradient-card shadow-card border-0 max-w-md mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 inline-block mx-auto">
            <Trophy className="w-16 h-16 text-accent" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">¡Rompecabezas Completado!</h2>
            <p className="text-muted-foreground">{gameName}</p>
          </div>
          <div className="flex justify-center gap-2">
            {[...Array(3)].map((_, i) => (
              <Star
                key={i}
                className={`w-8 h-8 ${
                  i < stars
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground/30"
                } transition-all duration-300`}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{score}</p>
              <p className="text-xs text-muted-foreground">Puntos</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100">
              <p className="text-2xl font-bold text-green-600">{correctCount}/{TOTAL_WORDS}</p>
              <p className="text-xs text-muted-foreground">Palabras</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10">
              <p className="text-2xl font-bold text-accent">{hintsUsed}</p>
              <p className="text-xs text-muted-foreground">Pistas usadas</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/10">
              <p className="text-2xl font-bold text-secondary">{formatTime(elapsedSeconds)}</p>
              <p className="text-xs text-muted-foreground">Tiempo</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <Button onClick={resetGame} className="flex-1 bg-gradient-primary shadow-glow">
              <RefreshCw className="w-4 h-4 mr-2" />
              Jugar otra vez
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(elapsedSeconds)}
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            Puntos: {score}
          </Badge>
          <Badge className="text-sm px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {currentWordIndex + 1}/{TOTAL_WORDS}
          </Badge>
        </div>
        <Button variant="outline" size="icon" onClick={resetGame} title="Reiniciar">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Puzzle */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-semibold text-foreground">{gameName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nivel {difficulty} — Descubre la palabra oculta
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-primary transition-all duration-500 rounded-full"
              style={{ width: `${(currentWordIndex / TOTAL_WORDS) * 100}%` }}
            />
          </div>

          {/* Scrambled word */}
          <div className={`
            text-center p-8 rounded-2xl transition-all duration-300
            ${feedback === "correct" ? "bg-green-50 border-2 border-green-300 scale-105" : ""}
            ${feedback === "wrong" ? "bg-red-50 border-2 border-red-300 scale-95" : ""}
            ${!feedback ? "bg-gradient-to-br from-accent/5 to-primary/5 border-2 border-accent/10" : ""}
          `}>
            <div className="text-4xl md:text-5xl font-bold tracking-widest text-foreground mb-2 select-none">
              {scrambledWords[currentWordIndex]?.split("").map((letter, i) => (
                <span
                  key={i}
                  className="inline-block px-1 md:px-2 animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s`, animationDuration: "0.5s" }}
                >
                  {letter}
                </span>
              )) || "---"}
            </div>
            {showHint && (
              <div className="mt-3 p-2 rounded-lg bg-yellow-50 border border-yellow-200 inline-block">
                <Lightbulb className="w-4 h-4 inline-block text-yellow-600 mr-1" />
                <span className="text-yellow-700 font-medium text-lg tracking-widest">{currentHint}</span>
              </div>
            )}
            {feedback === "correct" && (
              <p className="text-green-600 font-semibold mt-2 animate-bounce">¡Correcto! 🎉</p>
            )}
            {feedback === "wrong" && (
              <p className="text-red-600 font-semibold mt-2">
                La palabra era: <strong>{words[currentWordIndex]}</strong>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScramble}
              disabled={feedback !== null}
              className="gap-1"
            >
              <Shuffle className="w-4 h-4" />
              Reordenar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHint}
              disabled={feedback !== null || showHint}
              className="gap-1"
            >
              <Lightbulb className="w-4 h-4" />
              Pista (-30 pts)
            </Button>
            <div className="flex-1" />
            <p className="text-xs text-muted-foreground">
              {words[currentWordIndex]?.length || 0} letras
            </p>
          </div>

          {/* Input */}
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Escribe la palabra..."
              disabled={feedback !== null}
              className="flex-1 px-4 py-3 text-xl text-center uppercase tracking-widest rounded-xl border-2 border-input bg-background focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all duration-200"
              autoFocus
            />
            <Button
              onClick={handleSubmit}
              disabled={!userAnswer || feedback !== null}
              className="bg-gradient-primary shadow-glow h-12 px-6"
            >
              Verificar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
