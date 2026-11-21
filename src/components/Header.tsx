"use client";
import { ClipboardCheck, FlaskConical, HelpCircle, Info, LogOut, Menu, RotateCcw, Settings, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { LANGS } from "@/i18n";
import { adviserActive, adviserFocusCase, customerActive, headerVariant, planHref, type AdviserNavId, type CustomerNavId } from "@/lib/nav";
import { useApp } from "@/store/AppProvider";
import { useWorkflow } from "@/store/WorkflowProvider";
import { Logo } from "./ds";
import { NotificationBell } from "./Notifications";
import { Sheet } from "./Sheet";
import { Btn, LinkBtn } from "./ui";

/** The "this is a demo" notice. Always visible, in lavender, in every header. */
function DemoPill({ label, short, className = "" }: { label: string; short?: string; className?: string }) {
  return (
    <span className={`ac-pill ac-pill-demo ${className}`}>
      <FlaskConical size={14} aria-hidden />
      <span className={short ? "max-[1399px]:hidden" : ""}>{label}</span>
      {short && <span className="min-[1400px]:hidden">{short}</span>}
    </span>
  );
}

function LangSwitch({ compact }: { compact?: boolean }) {
  const { t, lang, setLang } = useApp();
  return (
    <div role="group" aria-label={t("header.language")} className="ac-lang" style={compact ? { fontSize: 11 } : undefined}>
      {LANGS.map((l) => (
        <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} aria-label={l.full} onClick={() => setLang(l.id)}>
          {l.short}
        </button>
      ))}
    </div>
  );
}

/** "Role: Customer ▾". Demo only: choosing a role signs in as that demo account (there is no password). */
function RoleMenu({ role, onPick, className = "" }: { role: "user" | "adviser"; onPick: (r: "user" | "adviser") => void; className?: string }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const label = t("role.pill", { role: role === "adviser" ? t("role.adviser") : t("role.customer") });
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" className="ac-pill" aria-haspopup="menu" aria-expanded={open} aria-label={`${label} (${t("header.role")})`} onClick={() => setOpen((o) => !o)}>
        <span className="max-w-[11rem] truncate">{label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && (
        <div role="menu" className="s-dark absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-[#444] bg-[#242424] p-2 shadow-modal">
          {(
            [
              ["user", <UserRound key="u" size={18} aria-hidden />, t("menu.user")],
              ["adviser", <ClipboardCheck key="a" size={18} aria-hidden />, t("menu.adviser")],
            ] as const
          ).map(([id, icon, text]) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={role === id}
              onClick={() => {
                setOpen(false);
                onPick(id);
              }}
              className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-white/10 ${role === id ? "bg-white/10" : ""}`}
            >
              {icon}
              <span className="flex-1">{text}</span>
              {role === id && <span aria-hidden>✓</span>}
            </button>
          ))}
          <p className="px-3 pb-2 pt-1 text-xs text-muted">{t("role.demoNote")}</p>
        </div>
      )}
    </div>
  );
}

function NavLink({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined}>
      {children}
    </Link>
  );
}

function CustomerNav({ active, planTo }: { active: CustomerNavId | null; planTo: string }) {
  const { t } = useApp();
  return (
    <nav aria-label={t("nav2.main")} className="ac-nav flex gap-1 max-md:flex-wrap">
      <NavLink href="/dashboard" on={active === "home"}>{t("nav2.home")}</NavLink>
      <NavLink href={planTo} on={active === "plan"}>{t("nav2.plan")}</NavLink>
      <NavLink href="/second-opinion" on={active === "second"}>{t("nav2.second")}</NavLink>
      <NavLink href="/learn" on={active === "learn"}>{t("nav2.learn")}</NavLink>
      <NavLink href="/settings" on={active === "settings"}>{t("nav2.settings")}</NavLink>
    </nav>
  );
}

/** The adviser items; "My Queue" is a view of the console, so it needs the query string (read inside Suspense). */
function AdviserNav({ path, focus }: { path: string; focus: string | null }) {
  const { t } = useApp();
  const view = useSearchParams().get("view");
  const active: AdviserNavId | null = adviserActive(path, view);
  const base = focus ? `/adviser/case/${encodeURIComponent(focus)}` : null;
  return (
    <nav aria-label={t("nav2.main")} className="ac-nav flex gap-1 max-md:flex-wrap">
      <NavLink href="/adviser" on={active === "cases"}>{t("nav2.cases")}</NavLink>
      <NavLink href="/adviser?view=mine" on={active === "queue"}>{t("nav2.queue")}</NavLink>
      <NavLink href={base ? `${base}/copilot` : "/adviser"} on={active === "copilot"}>{t("nav2.copilot")}</NavLink>
      <NavLink href={base ? `${base}/audit` : "/adviser"} on={active === "audit"}>{t("nav2.audit")}</NavLink>
      <NavLink href="/settings" on={active === "settings"}>{t("nav2.settings")}</NavLink>
    </nav>
  );
}

function PublicNav({ path }: { path: string }) {
  const { t } = useApp();
  const on = (p: string) => path === p || path.startsWith(`${p}/`);
  return (
    <nav aria-label={t("nav2.main")} className="ac-nav flex gap-1 max-md:flex-wrap">
      <NavLink href="/learn" on={on("/learn")}>{t("nav2.learn")}</NavLink>
      <NavLink href="/second-opinion" on={on("/second-opinion")}>{t("nav2.second")}</NavLink>
      <NavLink href="/transparency" on={on("/transparency")}>{t("nav2.earn")}</NavLink>
      <NavLink href="/about" on={on("/about")}>{t("nav2.about")}</NavLink>
    </nav>
  );
}

export function Header() {
  const { state, t } = useApp();
  const wf = useWorkflow();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<null | "clear" | "reset">(null);
  const variant = headerVariant(path, wf.role, !!state?.profile);
  const role = wf.role === "adviser" ? "adviser" : "user";
  const lang = useApp().lang;
  const initial = variant === "adviser" ? "MI" : (state?.profile?.name || "").slice(0, 1).toUpperCase() || "P";

  // Demo "authentication": switching role starts a real session as that demo account (no password).
  const switchRole = async (r: "user" | "adviser") => {
    if (r === "adviser") {
      if (await wf.signIn("adviser", lang)) router.push("/adviser");
      return;
    }
    if (wf.role === "adviser") {
      if (state?.personaId && state.profile) {
        await wf.signIn(state.personaId, lang);
        router.push("/dashboard");
      } else {
        await wf.signOut();
        router.push("/");
      }
      return;
    }
    router.push(state?.profile ? "/dashboard" : "/");
  };

  const item = (icon: ReactNode, label: string, onClick: () => void) => (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/10">
        <span className="grid size-10 place-items-center rounded-full border border-[#4a4a4a] text-lime">{icon}</span>
        <span className="font-medium">{label}</span>
      </button>
    </li>
  );
  const go = (href: string) => {
    setMenu(false);
    router.push(href);
  };

  const planTo = planHref(wf.myCase);
  const focus = adviserFocusCase(wf.queue, wf.me?.id);

  return (
    <header className="sticky top-0 z-30 border-b border-[#2e2e2e] bg-char text-white-ac">
      <div className="ac-wrap flex min-h-[64px] items-center gap-x-3 gap-y-2 md:min-h-[76px] md:gap-x-5">
        <Logo className="shrink-0" size={34} />
        {/* desktop navigation sits in the bar from 1120px; on a tablet it drops to its own row below */}
        <div className="hidden xl:block">
          {variant === "customer" && <CustomerNav active={customerActive(path)} planTo={planTo} />}
          {variant === "adviser" && (
            <Suspense fallback={null}>
              <AdviserNav path={path} focus={focus} />
            </Suspense>
          )}
          {variant === "public" && <PublicNav path={path} />}
        </div>
        <span className="flex-1" />

        {variant !== "public" && <RoleMenu role={role} onPick={(r) => void switchRole(r)} className="max-sm:hidden" />}
        <LangSwitch compact />
        <DemoPill label={t("app.demoPill")} short="Demo" className="hidden md:inline-flex" />
        {variant === "public" && (
          <LinkBtn href="/intake" small className="ac-btn-lime hidden md:inline-flex">
            {t("nav2.start")}
          </LinkBtn>
        )}
        {variant !== "public" && <NotificationBell />}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label={t("menu.title")}
          className={variant === "public" ? "grid size-11 place-items-center rounded-full border border-[#4a4a4a] md:hidden" : "ac-av"}
        >
          {variant === "public" ? <Menu size={20} aria-hidden /> : initial}
        </button>
      </div>

      {/* tablet: the navigation gets its own row (it never wraps into the controls) */}
      <div className="ac-wrap hidden pb-3 md:block xl:hidden">
        {variant === "customer" && <CustomerNav active={customerActive(path)} planTo={planTo} />}
        {variant === "adviser" && (
          <Suspense fallback={null}>
            <AdviserNav path={path} focus={focus} />
          </Suspense>
        )}
        {variant === "public" && <PublicNav path={path} />}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t("menu.title")}>
        <ul className="space-y-1">
          {/* on a phone the controls that do not fit in the bar live here */}
          {variant === "adviser" && (
            <>
              {item(<ClipboardCheck size={20} aria-hidden />, t("nav2.cases"), () => go("/adviser"))}
              {item(<UserRound size={20} aria-hidden />, t("nav2.queue"), () => go("/adviser?view=mine"))}
              {focus && item(<Info size={20} aria-hidden />, t("nav2.copilot"), () => go(`/adviser/case/${encodeURIComponent(focus)}/copilot`))}
              {focus && item(<Info size={20} aria-hidden />, t("nav2.audit"), () => go(`/adviser/case/${encodeURIComponent(focus)}/audit`))}
            </>
          )}
          {variant === "public" && (
            <>
              {item(<Info size={20} aria-hidden />, t("nav2.learn"), () => go("/learn"))}
              {item(<HelpCircle size={20} aria-hidden />, t("nav2.second"), () => go("/second-opinion"))}
              {item(<Info size={20} aria-hidden />, t("nav2.about"), () => go("/about"))}
              <li className="px-2 pb-1 pt-2">
                <LinkBtn href="/intake" block onClick={() => setMenu(false)}>
                  {t("nav2.start")}
                </LinkBtn>
              </li>
            </>
          )}
          {variant !== "public" && (
            <li className="px-2 pb-2">
              <p className="mb-1 text-xs font-semibold text-muted">{t("menu.role")}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={role === "user"} className="ac-chip ac-chip-neu min-h-11 px-4" onClick={() => { setMenu(false); void switchRole("user"); }}>
                  {t("menu.user")}
                </button>
                <button type="button" aria-pressed={role === "adviser"} className="ac-chip ac-chip-neu min-h-11 px-4" onClick={() => { setMenu(false); void switchRole("adviser"); }}>
                  {t("menu.adviser")}
                </button>
              </div>
            </li>
          )}
          {item(<Info size={20} aria-hidden />, t("menu.howWeEarn"), () => go("/transparency"))}
          {variant !== "public" && item(<Settings size={20} aria-hidden />, t("menu.settings"), () => go("/settings"))}
          {item(<HelpCircle size={20} aria-hidden />, t("menu.help"), () => go("/help"))}
          {item(<Trash2 size={20} aria-hidden />, t("menu.clear"), () => {
            setMenu(false);
            setConfirm("clear");
          })}
          {item(<RotateCcw size={20} aria-hidden />, t("menu.reset"), () => {
            setMenu(false);
            setConfirm("reset");
          })}
          {wf.me &&
            item(<LogOut size={20} aria-hidden />, t("auth.signOut"), () => {
              setMenu(false);
              void wf.signOut().then(() => router.push("/"));
            })}
        </ul>
        <div className="mt-3 flex items-center justify-between gap-3 px-2 md:hidden">
          <DemoPill label={t("app.demoPill")} />
        </div>
      </Sheet>

      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "clear" ? t("clear.title") : t("reset.title")}>
        <p className="text-muted">{confirm === "clear" ? t("clear.body") : t("reset.body")}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {/* the safe choice is first, and focused: Escape and Cancel both leave everything as it is */}
          <Btn variant="secondary" autoFocus onClick={() => setConfirm(null)}>
            {t("common.cancel")}
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              if (confirm === "clear") void wf.deleteMyData();
              else void wf.resetMyDemo();
              setConfirm(null);
              router.push("/");
            }}
          >
            {confirm === "clear" ? t("clear.confirm") : t("reset.confirm")}
          </Btn>
        </div>
      </Sheet>
    </header>
  );
}
