import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { initPushListeners, setPushOpenHandler, syncPushAfterSignIn } from "@/lib/push";

/** Keeps this device's phone/browser alerts attached to the signed-in account and opens tapped alerts in-app. */
const PushRegistrar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setPushOpenHandler((path) => navigate(path));
    void initPushListeners();
    return () => setPushOpenHandler(null);
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;
    const t = window.setTimeout(() => void syncPushAfterSignIn(), 1500);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  return null;
};

export default PushRegistrar;
