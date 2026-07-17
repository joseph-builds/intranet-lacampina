import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Clock, Trophy, Star, RefreshCw } from "lucide-react";

interface MemoryGameProps {
  gameId: string;
  gameName: string;
  difficulty: number;
  onComplete: (score: number, durationSeconds: number) => void;
  onBack: () => void;
}

interface CardData {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EMOJIS = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🐯", "🦁", "🐮", "🦄", "🐧", "🐸", "🐵",
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function MemoryGame({ gameId, gameName, difficulty, onComplete, onBack }: MemoryGameProps) {
  const pairCount = Math.min(6 + difficulty * 2, 16);
  const gridCols = Math.min(Math.ceil(Math.sqrt(pairCount * 2)), 6);

  const [cards, setCards] = useState<CardData[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Initialize game
  useEffect(() => {
    const selectedEmojis = shuffleArray(EMOJIS).slice(0, pairCount);
    const cardPairs = [...selectedEmojis, ...selectedEmojis].map((emoji, index) => ({
      id: index,
      emoji,
      isFlipped: false,
      isMatched: false,
    }));
    setCards(shuffleArray(cardPairs));
  }, [difficulty, pairCount]);

  // Timer
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

  const handleCardClick = useCallback(
    (index: number) => {
      if (isChecking || gameFinished) return;
      if (cards[index].isFlipped || cards[index].isMatched) return;

      if (!gameStarted) setGameStarted(true);

      const newCards = [...cards];
      newCards[index] = { ...newCards[index], isFlipped: true };
      setCards(newCards);

      const newFlipped = [...flippedIndices, index];
      setFlippedIndices(newFlipped);

      if (newFlipped.length === 2) {
        setMoves((prev) => prev + 1);
        setIsChecking(true);

        const [first, second] = newFlipped;
        if (cards[first].emoji === cards[second].emoji) {
          // Match found
          setTimeout(() => {
            setCards((prev) => {
              const updated = [...prev];
              updated[first] = { ...updated[first], isMatched: true };
              updated[second] = { ...updated[second], isMatched: true };
              return updated;
            });
            setMatchedPairs((prev) => {
              const newCount = prev + 1;
              if (newCount === pairCount) {
                const finalTime = elapsedSeconds;
                setGameFinished(true);
                const score = Math.max(100, Math.round((pairCount * 1000) / (moves + 1) / (finalTime + 1) * 10));
                setTimeout(() => {
                  onComplete(score, finalTime);
                  setShowResult(true);
                }, 500);
              }
              return newCount;
            });
            setFlippedIndices([]);
            setIsChecking(false);
          }, 400);
        } else {
          // No match
          setTimeout(() => {
            setCards((prev) => {
              const updated = [...prev];
              updated[first] = { ...updated[first], isFlipped: false };
              updated[second] = { ...updated[second], isFlipped: false };
              return updated;
            });
            setFlippedIndices([]);
            setIsChecking(false);
          }, 800);
        }
      }
    },
    [cards, flippedIndices, isChecking, gameFinished, gameStarted, pairCount, moves, elapsedSeconds, onComplete]
  );

  const resetGame = () => {
    const selectedEmojis = shuffleArray(EMOJIS).slice(0, pairCount);
    const cardPairs = [...selectedEmojis, ...selectedEmojis].map((emoji, index) => ({
      id: index,
      emoji,
      isFlipped: false,
      isMatched: false,
    }));
    setCards(shuffleArray(cardPairs));
    setFlippedIndices([]);
    setMatchedPairs(0);
    setMoves(0);
    setIsChecking(false);
    setGameStarted(false);
    setGameFinished(false);
    setElapsedSeconds(0);
    setShowResult(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getEfficiencyStars = () => {
    if (moves <= pairCount + 2) return 3;
    if (moves <= pairCount * 2) return 2;
    return 1;
  };

  if (showResult) {
    const stars = getEfficiencyStars();
    return (
      <Card className="bg-gradient-card shadow-card border-0 max-w-md mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 inline-block mx-auto">
            <Trophy className="w-16 h-16 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">¡Juego Completado!</h2>
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
              <p className="text-2xl font-bold text-primary">
                {Math.max(100, Math.round((pairCount * 1000) / (moves + 1) / (elapsedSeconds + 1) * 10))}
              </p>
              <p className="text-xs text-muted-foreground">Puntos</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/10">
              <p className="text-2xl font-bold text-secondary">{formatTime(elapsedSeconds)}</p>
              <p className="text-xs text-muted-foreground">Tiempo</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10">
              <p className="text-2xl font-bold text-accent">{moves}</p>
              <p className="text-xs text-muted-foreground">Movimientos</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10">
              <p className="text-2xl font-bold text-primary">{pairCount}</p>
              <p className="text-xs text-muted-foreground">Pares</p>
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
    <div className="space-y-4 max-w-4xl mx-auto">
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
            Movimientos: {moves}
          </Badge>
          <Badge className="text-sm px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {matchedPairs}/{pairCount} pares
          </Badge>
        </div>
        <Button variant="outline" size="icon" onClick={resetGame} title="Reiniciar">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Game Board */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-semibold text-foreground">{gameName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Encuentra todos los pares de emojis iguales
          </p>
        </CardHeader>
        <CardContent>
          <div
            className="grid gap-2 md:gap-3 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              maxWidth: `${gridCols * 80}px`,
            }}
          >
            {cards.map((card, index) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(index)}
                className={`
                  aspect-square rounded-xl text-2xl md:text-3xl font-bold
                  transition-all duration-300 transform
                  ${
                    card.isMatched
                      ? "bg-gradient-to-br from-green-100 to-green-50 border-2 border-green-300 scale-95 opacity-70 cursor-default"
                      : card.isFlipped
                      ? "bg-gradient-to-br from-primary/20 to-primary/10 border-2 border-primary/40 scale-100 shadow-md rotate-y-0"
                      : "bg-gradient-to-br from-primary/80 to-primary/60 border-2 border-primary/30 hover:from-primary/70 hover:to-primary/50 hover:scale-105 hover:shadow-glow cursor-pointer"
                  }
                  ${!card.isMatched && !card.isFlipped ? "hover:shadow-lg" : ""}
                  disabled={card.isMatched || card.isFlipped || isChecking}
                `}
              >
                <div className="flex items-center justify-center w-full h-full">
                  {card.isFlipped || card.isMatched ? card.emoji : "?"}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
