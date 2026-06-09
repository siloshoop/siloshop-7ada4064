import { useParams, Link, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, ArrowRight } from "lucide-react";
import { getPostBySlug, blogPosts } from "@/data/blogPosts";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  useEffect(() => {
    if (post) {
      document.title = `${post.title} | SiloShop`;
      window.scrollTo(0, 0);
    }
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  const related = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <article>
          <div className="relative w-full h-[40vh] md:h-[55vh] overflow-hidden">
            <img
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
            <div className="max-w-3xl mx-auto prose prose-lg dark:prose-invert">
              {post.content.map((section, i) => (
                <div key={i} className="mb-8">
                  {section.heading && (
                    <h2 className="text-2xl font-bold mb-3 text-foreground">{section.heading}</h2>
                  )}
                  <p className="text-base md:text-lg leading-relaxed text-muted-foreground">
                    {section.paragraph}
                  </p>
                </div>
              ))}
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