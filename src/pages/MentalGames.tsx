import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, MemoryStick, Calculator, Puzzle, Trophy, Star } from "lucide-react";
import { MemoryGame } from "@/components/mental-games/MemoryGame";
import { MathChallenge } from "@/components/mental-games/MathChallenge";
import { WordPuzzle } from "@/components/mental-games/WordPuzzle";

interface MentalGame {
  id: string;
  name: string;
  description: string | null;
  game_type: string;
  difficulty_level: number | null;
  instructions: string | null;
  is_active: boolean | null;
}

interface BestScore {
  game_id: string;
  best_score: number;
  total_played: number;
}

type GameView = "menu" | "memory" | "math" | "word";

const MentalGames = () => {
  const { profile } = useAuth();
  const [games, setGames] = useState<MentalGame[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, BestScore>>({});
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameView>("menu");

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    if (!profile?.id) return;

    try {
      // Fetch available games
      const { data: gamesData, error: gamesError } = await supabase
        .from("mental_games")
        .select("*")
        .eq("is_active", true)
        .order("difficulty_level", { ascending: true });

      if (gamesError) throw gamesError;

      setGames(gamesData || []);

      // Fetch user's best scores
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("game_sessions")
        .select("game_id, score")
        .eq("player_id", profile.id);

      if (sessionsError) throw sessionsError;

      // Aggregate best scores
      const scores: Record<string, BestScore> = {};
      sessionsData?.forEach((session) => {
        if (!scores[session.game_id]) {
          scores[session.game_id] = {
            game_id: session.game_id,
            best_score: session.score,
            total_played: 1,
          };
        } else {
          scores[session.game_id].best_score = Math.max(
            scores[session.game_id].best_score,
            session.score
          );
          scores[session.game_id].total_played++;
        }
      });

      setBestScores(scores);
    } catch (error) {
      console.error("Error fetching games:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGameComplete = async (
    gameId: string,
    score: number,
    durationSeconds: number
  ) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase.from("game_sessions").insert({
        game_id: gameId,
        player_id: profile.id,
        score,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Refresh scores
      fetchGames();
    } catch (error) {
      console.error("Error saving game session:", error);
    }
  };

  const goBackToMenu = () => {
    setActiveGame("menu");
  };

  const getGameIcon = (gameType: string) => {
    switch (gameType) {
      case "memory":
        return <MemoryStick className="w-12 h-12 text-primary" />;
      case "math":
        return <Calculator className="w-12 h-12 text-secondary" />;
      case "word":
        return <Puzzle className="w-12 h-12 text-accent" />;
      default:
        return <Brain className="w-12 h-12 text-primary" />;
    }
  };

  const getDifficultyBadge = (level: number | null) => {
    if (!level) return null;
    const labels = ["", "Fácil", "Medio", "Difícil", "Experto", "Maestro"];
    const colors = [
      "",
      "bg-green-100 text-green-800 border-green-200",
      "bg-yellow-100 text-yellow-800 border-yellow-200",
      "bg-orange-100 text-orange-800 border-orange-200",
      "bg-red-100 text-red-800 border-red-200",
      "bg-purple-100 text-purple-800 border-purple-200",
    ];
    return (
      <Badge className={`${colors[level] || ""} text-xs`} variant="outline">
        {labels[level] || `Nivel ${level}`}
      </Badge>
    );
  };

  const getGameComponent = () => {
    const selectedGame = games.find((g) => {
      if (activeGame === "memory") return g.game_type === "memory";
      if (activeGame === "math") return g.game_type === "math";
      if (activeGame === "word") return g.game_type === "word";
      return false;
    });

    switch (activeGame) {
      case "memory":
        return (
          <MemoryGame
            gameId={selectedGame?.id || ""}
            gameName={selectedGame?.name || "Memory Game"}
            difficulty={selectedGame?.difficulty_level || 1}
            onComplete={(score, duration) =>
              handleGameComplete(selectedGame?.id || "", score, duration)
            }
            onBack={goBackToMenu}
          />
        );
      case "math":
        return (
          <MathChallenge
            gameId={selectedGame?.id || ""}
            gameName={selectedGame?.name || "Math Challenge"}
            difficulty={selectedGame?.difficulty_level || 1}
            onComplete={(score, duration) =>
              handleGameComplete(selectedGame?.id || "", score, duration)
            }
            onBack={goBackToMenu}
          />
        );
      case "word":
        return (
          <WordPuzzle
            gameId={selectedGame?.id || ""}
            gameName={selectedGame?.name || "Word Puzzle"}
            difficulty={selectedGame?.difficulty_level || 1}
            onComplete={(score, duration) =>
              handleGameComplete(selectedGame?.id || "", score, duration)
            }
            onBack={goBackToMenu}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold text-foreground">Juegos Mentales</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-gradient-card shadow-card border-0">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="w-12 h-12 bg-muted rounded-xl" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (activeGame !== "menu") {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6">
          {getGameComponent()}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/10">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Juegos Mentales</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Entrena tu mente con desafíos interactivos
              </p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.keys(bestScores).length}
                </p>
                <p className="text-xs text-muted-foreground">Juegos jugados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Star className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.values(bestScores).reduce((sum, s) => sum + s.total_played, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Partidas jugadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Trophy className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {Object.values(bestScores).reduce((sum, s) => sum + s.best_score, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Puntos totales</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Games Grid */}
        {games.length === 0 ? (
          <Card className="bg-gradient-card shadow-card border-0">
            <CardContent className="p-8 text-center">
              <Brain className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay juegos disponibles
              </h3>
              <p className="text-muted-foreground">
                Pronto tendremos nuevos juegos mentales para ti.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => {
              const userScore = bestScores[game.id];
              return (
                <Card
                  key={game.id}
                  className="bg-gradient-card shadow-card border-0 hover:shadow-glow transition-all duration-300 group cursor-pointer"
                  onClick={() => {
                    if (game.game_type === "memory") setActiveGame("memory");
                    else if (game.game_type === "math") setActiveGame("math");
                    else if (game.game_type === "word") setActiveGame("word");
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:scale-110 transition-transform duration-300">
                        {getGameIcon(game.game_type)}
                      </div>
                      {game.difficulty_level && (
                        <div className="flex gap-1">
                          {getDifficultyBadge(game.difficulty_level)}
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-lg font-semibold text-foreground mt-4">
                      {game.name}
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground line-clamp-2">
                      {game.description || "Pon a prueba tu mente con este desafiante juego."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {game.instructions && (
                      <p className="text-xs text-muted-foreground mb-3 italic line-clamp-2">
                        💡 {game.instructions}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {userScore ? (
                          <>
                            <Trophy className="w-4 h-4 text-primary" />
                            <span>Mejor: <strong>{userScore.best_score}</strong></span>
                            <span className="text-xs opacity-60">
                              ({userScore.total_played} partidas)
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aún no jugado</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="bg-gradient-primary shadow-glow opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        Jugar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MentalGames;
