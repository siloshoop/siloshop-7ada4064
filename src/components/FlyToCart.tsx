import { createContext, useContext, useState, useCallback, useRef } from "react";

interface FlyItem {
  id: string;
  startX: number;
  startY: number;
  image: string;
}

interface FlyToCartContextType {
  triggerFly: (startX: number, startY: number, image: string) => void;
  cartRef: React.RefObject<HTMLElement | null>;
}

const FlyToCartContext = createContext<FlyToCartContextType | null>(null);

export const useFlyToCart = () => {
  const ctx = useContext(FlyToCartContext);
  if (!ctx) return { triggerFly: () => {}, cartRef: { current: null } };
  return ctx;
};

export const FlyToCartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<FlyItem[]>([]);
  const cartRef = useRef<HTMLElement | null>(null);

  const triggerFly = useCallback((startX: number, startY: number, image: string) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, startX, startY, image }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 800);
  }, []);

  return (
    <FlyToCartContext.Provider value={{ triggerFly, cartRef }}>
      {children}
      {items.map((item) => (
        <FlyingItem key={item.id} item={item} cartRef={cartRef} />
      ))}
    </FlyToCartContext.Provider>
  );
};

const FlyingItem = ({
  item,
  cartRef,
}: {
  item: FlyItem;
  cartRef: React.RefObject<HTMLElement | null>;
}) => {
  const cartEl = cartRef.current;
  let endX = window.innerWidth / 2;
  let endY = 20;

  if (cartEl) {
    const rect = cartEl.getBoundingClientRect();
    endX = rect.left + rect.width / 2;
    endY = rect.top + rect.height / 2;
  }

  const dx = endX - item.startX;
  const dy = endY - item.startY;

  return (
    <div
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: item.startX,
        top: item.startY,
        transform: "translate(-50%, -50%)",
        animation: "flyToCart 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards",
        // @ts-ignore
        "--fly-dx": `${dx}px`,
        "--fly-dy": `${dy}px`,
      } as React.CSSProperties}
    >
      <div
        className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl border-2 border-primary/50 bg-card"
        style={{
          animation: "flyScale 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards",
        }}
      >
        <img src={item.image} alt="" className="w-full h-full object-cover" />
      </div>
    </div>
  );
};
