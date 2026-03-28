import { useEffect } from "react";
import { useRouter } from "next/router";

export default function CompanyLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?mode=company");
  }, [router]);

  return null;
}
