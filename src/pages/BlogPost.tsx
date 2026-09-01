import { useParams, Link, Navigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Clock, ArrowRight, ShoppingBag, Mail, ListOrdered } from "lucide-react";
import { getPostBySlug, getRelatedPosts, slugifyHeading } from "@/data/blogPosts";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | SiloShop`;
      window.scrollTo(0, 0);
    }
  }, [post]);

  const related = useMemo(() => (post ? getRelatedPosts(post, 3) : []), [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const toc = post.content
    .filter((s) => s.heading)
    .map((s) => ({ id: slugifyHeading(s.heading!), text: s.heading! }));
  const midIndex = Math.floor(post.content.length / 2);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <article>
          <div className="relative w-full h-[40vh] md:h-[55vh] overflow-hidden">
            <img loading="lazy" decoding="async"
              src={post.image}
              alt={post.title}
              width={1920}
              height={1080}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 container px-4 pb-8">
              <div className="max-w-3xl mx-auto">
                <Link to="/blog">
                  <Button variant="ghost" size="sm" className="mb-4">
                    <ArrowRight className="h-4 w-4 ml-1" />
                    العودة للمدونة
                  </Button>
                </Link>
                <Badge variant="secondary" className="mb-3">{post.category}</Badge>
                <h1 className="text-3xl md:text-5xl font-bold mb-3">{post.title}</h1>
                <p className="text-lg text-muted-foreground mb-4">{post.description}</p>
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
                </div>
              </div>
            </div>
          </div>

          <div className="container px-4 py-12">
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
              <div className="prose prose-lg dark:prose-invert max-w-none">
                {post.content.map((section, i) => (
                  <div key={i} className="mb-8">
                    {section.heading && (
                      <h2
                        id={slugifyHeading(section.heading)}
                        className="text-2xl font-bold mb-3 text-foreground scroll-mt-24"
                      >
                        {section.heading}
                      </h2>
                    )}
                    <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                      {section.paragraph}
                    </p>
                    {i === midIndex && (
                      <div className="my-8 rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-6 not-prose">
                        <div className="flex items-start gap-4">
                          <ShoppingBag className="h-8 w-8 text-primary shrink-0" />
                          <div className="flex-1">
                            <h3 className="font-bold mb-1">جرّب الآن على SiloShop</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              اكتشف آلاف المنتجات بأفضل الأسعار وتوصيل سريع.
                            </p>
                            <Button asChild size="sm">
                              <Link to="/">ابدأ التسوق</Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex flex-wrap gap-2 pt-6 border-t">
                  {post.tags.map((t) => (
                    <Badge key={t} variant="secondary">#{t}</Badge>
                  ))}
                </div>

                <div className="mt-10 rounded-xl border bg-card p-6 not-prose text-center">
                  <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">أعجبك المقال؟</h3>
                  <p className="text-muted-foreground mb-4">اشترك في نشرتنا لتصلك أحدث المقالات والعروض</p>
                  <Button asChild>
                    <Link to="/contact">تواصل معنا</Link>
                  </Button>
                </div>
              </div>

              <aside className="lg:sticky lg:top-24 self-start space-y-6">
                {toc.length > 0 && (
                  <div className="rounded-xl border bg-card p-5">
                    <div className="flex items-center gap-2 mb-3 font-bold">
                      <ListOrdered className="h-4 w-4" />
                      محتويات المقال
                    </div>
                    <ul className="space-y-2 text-sm">
                      {toc.map((item) => (
                        <li key={item.id}>
                          <a
                            href={`#${item.id}`}
                            className="text-muted-foreground hover:text-primary transition-colors block"
                          >
                            {item.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border bg-gradient-to-br from-primary/10 to-accent/10 p-5">
                  <h3 className="font-bold mb-2">ابدأ مشروعك معنا</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    اطلع على باقاتنا واختر ما يناسبك
                  </p>
                  <Button asChild size="sm" className="w-full">
                    <Link to="/pricing">عرض الباقات</Link>
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className="bg-muted/30 py-12">
            <div className="container px-4">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-2xl font-bold mb-6">مقالات ذات صلة</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {related.map((p) => (
                    <Link
                      key={p.slug}
                      to={`/blog/${p.slug}`}
                      className="group block bg-card rounded-lg overflow-hidden border hover:shadow-lg transition-all"
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-muted">
                        <img
                          src={p.image}
                          alt={p.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-4">
                        <Badge variant="secondary" className="mb-2 text-xs">{p.category}</Badge>
                        <h3 className="font-bold mb-1 group-hover:text-primary transition-colors">
                          {p.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;