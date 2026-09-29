import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sourcing")({
  head: () => ({
    meta: [{ title: "Sourcing & Chasse — Sprint Machine" }],
  }),
  component: SourcingRedirect,
});

function SourcingRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/chasse" });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <p className="text-[13px]" style={{ color: "var(--hint)" }}>
        Redirection vers le sourcing & chasse…
      </p>
    </div>
  );
}
