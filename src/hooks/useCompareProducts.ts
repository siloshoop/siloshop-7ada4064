import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "compare-products";
const MAX_PRODUCTS = 4;

export const useCompareProducts = () => {
  const [compareProducts, setCompareProducts] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareProducts));
  }, [compareProducts]);

  const addProduct = useCallback((productId: string): { success: boolean; message: string } => {
    if (compareProducts.includes(productId)) {
      return { success: false, message: "exists" };
    }
    
    if (compareProducts.length >= MAX_PRODUCTS) {
      return { success: false, message: "max" };
    }
    
    setCompareProducts(prev => [...prev, productId]);
    return { success: true, message: "added" };
  }, [compareProducts]);

  const removeProduct = useCallback((productId: string) => {
    setCompareProducts(prev => prev.filter(id => id !== productId));
  }, []);

  const clearProducts = useCallback(() => {
    setCompareProducts([]);
  }, []);

  const isInCompare = useCallback((productId: string) => {
    return compareProducts.includes(productId);
  }, [compareProducts]);

  return {
    compareProducts,
    compareCount: compareProducts.length,
    addProduct,
    removeProduct,
    clearProducts,
    isInCompare,
  };
};
