import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, Clock, ArrowLeft, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { blogPosts, getAllCategories, getAllTags } from "@/data/blogPosts";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

const Blog = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const categories = useMemo(() => getAllCategories(), []);
  const tags = useMemo(() => getAllTags(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blogPosts.filter((p) => {
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      const matchesCategory = !category || p.category === category;
      const matchesTag = !activeTag || p.tags.includes(activeTag);
      return matchesQuery && matchesCategory && matchesTag;
    });
  }, [query, category, activeTag]);

  const hasFilters = query || category || activeTag;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">المدونة</h1>
            <p className="text-muted-foreground text-lg">نصائح ومقالات مفيدة عن التسوق والتجارة الإلكترونية</p>
          </div>

          <div className="mb-8 space-y-4">
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في المقالات..."
                className="pr-10"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant={category === null ? "default" : "outline"}
                size="sm"
                onClick={() => setCategory(null)}
              >
                كل التصنيفات
              </Button>
              {categories.map((c) => (
                <Button
                  key={c}
                  variant={category === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategory(c === category ? null : c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {tags.map((t) => (
                <Badge
                  key={t}
                  variant={activeTag === t ? "default" : "secondary"}
                  className="cursor-pointer"
                  onClick={() => setActiveTag(t === activeTag ? null : t)}
                >
                  #{t}
                </Badge>
              ))}
            </div>
            {hasFilters && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setCategory(null);
                    setActiveTag(null);
                  }}
                >
                  <X className="h-4 w-4 ml-1" />
                  مسح التصفية
                </Button>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              لا توجد مقالات مطابقة لبحثك
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((post) => (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="group">
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 h-full group-hover:-translate-y-1">
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    <img
                      src={post.image}
                      alt={post.title}
                      loading="lazy"
                      width={1024}
                      height={576}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit mb-2">{post.category}</Badge>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">{post.title}</CardTitle>
                    <CardDescription>{post.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(post.date).toLocaleDateString("ar-SY")}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{post.author}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{post.readTime}</span>
                      </div>
                      <span className="mr-auto inline-flex items-center gap-1 text-primary font-medium">
                        اقرأ المزيد <ArrowLeft className="h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
