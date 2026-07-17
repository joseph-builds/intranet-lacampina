import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Clock, Trophy, Star, RefreshCw, Zap } from "lucide-react";

interface MathChallengeProps {
  gameId: string;
  gameName: string;
  difficulty: number;
  onComplete: (score: number, durationSeconds: number) => void;
  onBack: () => void;
}

interface MathProblem {
  num1: number;
  num2: number;
  operator: string;
  answer: number;
}

function generateProblem(difficulty: number): MathProblem {
  const maxNum = 10 * difficulty;
  const operators = ["+", "-"];
  if (difficulty >= 2) operators.push("×");
  if (difficulty >= 3) operators.push("÷");
  
  const operator = operators[Math.floor(Math.random() * operators.length)];
  let num1: number, num2: number, answer: number;

  switch (operator) {
    case "+":
      num1 = Math.floor(Math.random() * maxNum) + 1;
      num2 = Math.floor(Math.random() * maxNum) + 1;
      answer = num1 + num2;
      break;
    case "-":
      num1 = Math.floor(Math.random() * maxNum) + maxNum / 2;
      num2 = Math.floor(Math.random() * (num1 - 1)) + 1;
      answer = num1 - num2;
      break;
    case "×":
      num1 = Math.floor(Math.random() * Math.min(12, maxNum)) + 1;
      num2 = Math.floor(Math.random() * Math.min(12, maxNum)) + 1;
      answer = num1 * num2;
      break;
    case "÷":
      num2 = Math.floor(Math.random() * Math.min(12, maxNum)) + 1;
      answer = Math.floor(Math.random() * Math.min(12, maxNum)) + 1;
      num1 = num2 * answer;
      break;
    default:
      num1 = 1; num2 = 1; answer = 2;
  }

  return { num1, num2, operator, answer };
}

const TOTAL_QUESTIONS = 10;

export function MathChallenge({ gameId, gameName, difficulty, onComplete, onBack }: MathChallengeProps) {
  const [problems, setProblems] = useState<MathProblem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  const initProblems = () => {
    const probs: MathProblem[] = [];
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      probs.push(generateProblem(difficulty));
    }
    setProblems(probs);
  };

  useEffect(() => {
    initProblems();
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
  }, [gameStarted, currentQuestion]);

  const handleSubmit = () => {
    if (!gameStarted) setGameStarted(true);
    if (gameFinished || feedback !== null) return;

    const numAnswer = parseInt(userAnswer);
    if (isNaN(numAnswer)) return;

    const problem = problems[currentQuestion];
    const isCorrect = numAnswer === problem.answer;

    let questionScore = 0;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      const timeRemaining = Math.max(0, 30 - elapsedSeconds + currentQuestion * 3);
      questionScore = 100 + timeRemaining + streak * 10;
      setScore((prev) => prev + questionScore);
      setStreak((prev) => prev + 1);
      setBestStreak((prev) => Math.max(prev, streak + 1));
      setFeedback("correct");
    } else {
      setStreak(0);
      setFeedback("wrong");
    }

    // Use a ref to track the latest score for the final calculation
    const currentScore = score + questionScore;

    setTimeout(() => {
      setFeedback(null);
      if (currentQuestion + 1 >= TOTAL_QUESTIONS) {
        setGameFinished(true);
        const finalTime = elapsedSeconds;
        const initialTimeBonus = Math.max(0, 300 - finalTime * 2);
        setTimeBonus(initialTimeBonus);
        const finalScore = currentScore + initialTimeBonus;
        setTimeout(() => {
          onComplete(finalScore, finalTime);
          setShowResult(true);
        }, 500);
      } else {
        setCurrentQuestion((prev) => prev + 1);
        setUserAnswer("");
      }
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const resetGame = () => {
    initProblems();
    setCurrentQuestion(0);
    setUserAnswer("");
    setScore(0);
    setCorrectCount(0);
    setGameStarted(false);
    setGameFinished(false);
    setElapsedSeconds(0);
    setShowResult(false);
    setFeedback(null);
    setStreak(0);
    setBestStreak(0);
    setTimeBonus(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const displayOperator = (op: string) => {
    switch (op) {
      case "×": return "×";
      case "÷": return "÷";
      default: return op;
    }
  };

  if (showResult) {
    const totalPossible = TOTAL_QUESTIONS * 200 + 300;
    const percentage = Math.round((score + timeBonus) / totalPossible * 100);
    const stars = percentage >= 80 ? 3 : percentage >= 50 ? 2 : 1;

    return (
      <Card className="bg-gradient-card shadow-card border-0 max-w-md mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-6">
          <div className="p-4 rounded-full bg-gradient-to-br from-secondary/20 to-primary/20 inline-block mx-auto">
            <Trophy className="w-16 h-16 text-secondary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">¡Desafío Completado!</h2>
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
              <p className="text-2xl font-bold text-primary">{score + timeBonus}</p>
              <p className="text-xs text-muted-foreground">Puntos totales</p>
            </div>
            <div className="p-3 rounded-lg bg-green-100">
              <p className="text-2xl font-bold text-green-600">{correctCount}/{TOTAL_QUESTIONS}</p>
              <p className="text-xs text-muted-foreground">Correctas</p>
            </div>
            <div className="p-3 rounded-lg bg-accent/10">
              <p className="text-2xl font-bold text-accent">{bestStreak}</p>
              <p className="text-xs text-muted-foreground">Mejor racha</p>
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

  const problem = problems[currentQuestion];
  if (!problem) return null;

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
          {streak >= 2 && (
            <Badge className="text-sm px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 animate-pulse">
              <Zap className="w-3 h-3 mr-1" />
              ¡Racha x{streak}!
            </Badge>
          )}
          <Badge className="text-sm px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {currentQuestion + 1}/{TOTAL_QUESTIONS}
          </Badge>
        </div>
        <Button variant="outline" size="icon" onClick={resetGame} title="Reiniciar">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      {/* Problem */}
      <Card className="bg-gradient-card shadow-card border-0">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-semibold text-foreground">{gameName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nivel {difficulty} — Resuelve los problemas lo más rápido posible
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 rounded-full"
              style={{ width: `${((currentQuestion) / TOTAL_QUESTIONS) * 100}%` }}
            />
          </div>

          {/* Problem display */}
          <div className={`
            text-center p-8 rounded-2xl transition-all duration-300
            ${feedback === "correct" ? "bg-green-50 border-2 border-green-300 scale-105" : ""}
            ${feedback === "wrong" ? "bg-red-50 border-2 border-red-300 scale-95" : ""}
            ${!feedback ? "bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/10" : ""}
          `}>
            <div className="text-5xl md:text-6xl font-bold text-foreground space-x-4 mb-2">
              <span>{problem.num1}</span>
              <span className="text-primary">{displayOperator(problem.operator)}</span>
              <span>{problem.num2}</span>
              <span className="text-muted-foreground">=</span>
              <span className="text-primary">?</span>
            </div>
            {feedback === "correct" && (
              <p className="text-green-600 font-semibold mt-2 animate-bounce">¡Correcto! 🎉</p>
            )}
            {feedback === "wrong" && (
              <p className="text-red-600 font-semibold mt-2">
                Respuesta: {problem.answer}
              </p>
            )}
          </div>

          {/* Input */}
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tu respuesta..."
              disabled={feedback !== null}
              className="flex-1 px-4 py-3 text-xl text-center rounded-xl border-2 border-input bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
            <Button
              onClick={handleSubmit}
              disabled={!userAnswer || feedback !== null}
              className="bg-gradient-primary shadow-glow h-12 px-6"
            >
              Responder
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
