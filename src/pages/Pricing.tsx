import { Construction } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const Pricing = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-16 flex items-center justify-center">
        <Card className="max-w-xl w-full text-center border-dashed">
          <CardContent className="pt-10 pb-10 space-y-4">
            <div className="flex justify-center">
              <Construction className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold">🚧 قريبًا</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              نعمل حاليًا على تطوير نظام الباقات والأسعار.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              سيتم إطلاق هذه الميزة في تحديث قادم.
            </p>
            <p className="font-medium">شكرًا لصبركم.</p>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
