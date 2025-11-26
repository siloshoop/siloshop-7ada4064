import { Heart, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/components/FavoriteButton";

interface ProductCardProps {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  discount?: number;
}

const ProductCard = ({
  id,
  name,
  price,
  originalPrice,
  image,
  rating,
  reviews,
  discount
}: ProductCardProps) => {
  const navigate = useNavigate();

  const productId = id || Math.random().toString(36).substr(2, 9);

  return (
    <Card 
      className="group cursor-pointer overflow-hidden border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-2xl transition-all duration-500 bg-card"
      onClick={() => navigate(`/product/${productId}`)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {discount && (
          <Badge className="absolute top-3 left-3 z-10 bg-sale text-sale-foreground shadow-lg font-bold text-sm px-3 py-1 animate-pulse">
            -{discount}%
          </Badge>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-3 right-3 z-10 bg-white/95 hover:bg-primary hover:text-primary-foreground backdrop-blur-sm shadow-md transition-all duration-300 hover:scale-110"
          onClick={(e) => e.stopPropagation()}
        >
          {id ? (
            <FavoriteButton productId={id} variant="ghost" size="icon" />
          ) : (
            <Heart className="h-4 w-4" />
          )}
        </Button>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <img
          src={image}
          alt={name}
          className="object-cover w-full h-full group-hover:scale-110 group-hover:rotate-1 transition-all duration-700"
        />
      </div>
      
      <CardContent className="p-5 space-y-3">
        <h3 className="font-bold text-base line-clamp-2 min-h-[3rem] group-hover:text-primary transition-colors leading-tight">
          {name}
        </h3>
        
        <div className="flex items-center gap-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 transition-all duration-300 ${
                  i < Math.floor(rating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium">({reviews})</span>
        </div>
        
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-bold text-2xl text-primary">
                {price}
              </span>
              <span className="text-sm text-foreground/70">ل.س</span>
              {originalPrice && (
                <span className="text-sm text-muted-foreground line-through font-medium mr-auto">
                  {originalPrice}
                </span>
              )}
            </div>
        
        <Button 
          className="w-full shadow-md hover:shadow-lg transition-all duration-300 font-bold" 
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/product/${productId}`);
          }}
        >
          أضف للسلة
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
