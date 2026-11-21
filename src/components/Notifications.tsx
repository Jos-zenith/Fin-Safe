"use client";
import { Bell } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import { Sheet } from "./Sheet";
import { Btn } from "./ui";

/** In-app notifications. The count comes from the server's poll, so a new one appears without reloading. */
export function NotificationBell() {
  const { t, lang } = useApp();
  const wf = useWorkflow();
  const [open, setOpen] = useState(false);
  if (!wf.me) return null;
  const loc = lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "ta-IN";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("notif.bell", { n: wf.unread })}
        data-testid="notif-bell"
        className="relative grid size-10 place-items-center rounded-full hover:bg-white/15"
      >
        <Bell size={21} aria-hidden />
        {wf.unread > 0 && (
          <span data-testid="unread-badge" className="num absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-draft px-1 text-[11px] font-bold leading-5 text-bg">
            {wf.unread > 9 ? "9+" : wf.unread}
          </span>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("notif.title")}>
        <div className="text-fg">
          {wf.notifications.length === 0 ? (
            <p className="text-muted">{t("notif.empty")}</p>
          ) : (
            <>
              <ul className="space-y-2" data-testid="notif-list">
                {wf.notifications.map((n) => (
                  <li key={n.id} className={`rounded-xl border p-3 ${n.readAt ? "border-line" : "border-primary bg-primary-soft"}`}>
                    <p className="font-medium">{t(`notif.${n.kind}`, n.params)}</p>
                    <time dateTime={n.createdAt} className="num text-xs text-muted">
                      {new Date(n.createdAt).toLocaleString(loc, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </li>
                ))}
              </ul>
              {wf.unread > 0 && (
                <Btn block variant="secondary" className="mt-3" onClick={() => void wf.markRead("all")}>
                  {t("notif.markAll")}
                </Btn>
              )}
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
