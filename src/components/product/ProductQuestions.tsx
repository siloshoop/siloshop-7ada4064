import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";

interface Question {
  id: string;
  product_id: string;
  user_id: string;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  created_at: string;
}

interface Props {
  productId: string;
  vendorId: string;
}

const formatRelative = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  if (diffHour < 24) return `منذ ${diffHour} ساعة`;
  if (diffDay < 30) return `منذ ${diffDay} يوم`;
  return date.toLocaleDateString("ar-SY");
};

const ProductQuestions = ({ productId, vendorId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState<string | null>(null);

  const isVendor = !!user && user.id === vendorId;

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("product_questions")
        .select("*")
        .eq("product_id", productId)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "تعذر تحميل الأسئلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchQuestions();

    const channel = supabase
      .channel(`product-questions-${productId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_questions",
          filter: `product_id=eq.${productId}`,
        },
        () => {
          fetchQuestions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleSubmitQuestion = async () => {
    if (!user) return;
    const trimmed = newQuestion.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      toast({
        title: "خطأ",
        description: "يجب أن يكون السؤال بين 5 و 500 حرف",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("product_questions").insert({
        product_id: productId,
        user_id: user.id,
        question: trimmed,
        answer: null,
      });

      if (error) throw error;

      setNewQuestion("");
      toast({
        title: "تم الإرسال",
        description: "تم إرسال سؤالك بنجاح",
      });
      fetchQuestions();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "تعذر إرسال السؤال",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    if (!user) return;
    const answer = (answerDrafts[questionId] || "").trim();
    if (!answer) {
      toast({
        title: "خطأ",
        description: "يرجى كتابة إجابة",
        variant: "destructive",
      });
      return;
    }

    setAnswering(questionId);
    try {
      const { error } = await supabase
        .from("product_questions")
        .update({
          answer,
          answered_by: user.id,
          answered_at: new Date().toISOString(),
        })
        .eq("id", questionId);

      if (error) throw error;

      toast({
        title: "تم الرد",
        description: "تم إرسال الرد بنجاح",
      });
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: "" }));
      fetchQuestions();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "تعذر إرسال الرد",
        variant: "destructive",
      });
    } finally {
      setAnswering(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {user ? (
        <div className="space-y-2">
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="اكتب سؤالك حول هذا المنتج (5 إلى 500 حرف)"
            maxLength={500}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {newQuestion.trim().length}/500
            </span>
            <Button
              onClick={handleSubmitQuestion}
              disabled={submitting || newQuestion.trim().length < 5}
            >
              إرسال السؤال
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
          <span>يرجى تسجيل الدخول لطرح سؤال حول هذا المنتج.</span>
          <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
            تسجيل الدخول
          </Button>
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          لا توجد أسئلة بعد. كن أول من يسأل عن هذا المنتج.
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">{q.question}</p>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(q.created_at)}
                </span>
              </div>

              {q.answer ? (
                <div className="rounded-lg bg-muted/40 p-3 border-r-2 border-primary">
                  <p className="text-xs font-semibold text-primary mb-1">إجابة البائع</p>
                  <p className="text-sm text-foreground/90">{q.answer}</p>
                  {q.answered_at && (
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(q.answered_at)}
                    </span>
                  )}
                </div>
              ) : isVendor ? (
                <div className="space-y-2">
                  <Textarea
                    value={answerDrafts[q.id] || ""}
                    onChange={(e) =>
                      setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="اكتب ردك على هذا السؤال"
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitAnswer(q.id)}
                      disabled={answering === q.id}
                    >
                      الرد
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">بانتظار رد البائع</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductQuestions;
