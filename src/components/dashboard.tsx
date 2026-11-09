"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Plus,
  LayoutGrid,
  Layers,
  History,
  Spool,
  CheckCheck,
  ArrowUpRight,
  ChevronLeft,
  MessageCircle,
  Clock,
  Check,
  Users,
  LogOut,
  Flower2,
  Sparkles,
  PackageOpen,
  Menu,
} from "lucide-react";
import {
  statusLabels,
  getReadyQueue,
  validateRequest,
  validateFilaments,
  transitionOrder,
  type PrintOrder,
  type Filament,
  type Part,
  type OrderAction,
} from "@/lib/orders";
import {
  saveOrder,
  changeOrder,
  addComment,
  sendPendingNotifications,
} from "@/app/actions/orders";
import { saveFilament, inviteMember, retryEmails } from "@/app/actions/admin";
import { uploadReferences } from "@/app/actions/images";
import { signOut } from "@/app/actions/auth";
type Member = { id: string; name: string; role: "admin" | "member" };
type Props = {
  demo: boolean;
  initialOrders: PrintOrder[];
  initialFilaments: Filament[];
  member: Member;
  recipients: string[];
  selectedOrder?: string;
};
type Screen =
  | "queue"
  | "request"
  | "mine"
  | "history"
  | "filaments"
  | "review"
  | "settings";
const artFor = (title: string) =>
  /dragon/i.test(title)
    ? "🐉"
    : /sign|name/i.test(title)
      ? "🎀"
      : /star/i.test(title)
        ? "✨"
        : /plant/i.test(title)
          ? "🌱"
          : "🧩";
const prettyDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Pacific/Honolulu",
  });
export default function Dashboard({
  demo,
  initialOrders,
  initialFilaments,
  member,
  recipients,
  selectedOrder,
}: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders),
    [filaments, setFilaments] = useState(initialFilaments),
    [screen, setScreen] = useState<Screen>("queue"),
    [detail, setDetail] = useState<string | null>(selectedOrder ?? null),
    [edit, setEdit] = useState<PrintOrder | null>(null),
    [source, setSource] = useState<PrintOrder | null>(null),
    [notice, setNotice] = useState(""),
    [pending, startTransition] = useTransition(),
    [note, setNote] = useState(""),
    [comment, setComment] = useState("");
  useEffect(() => {
    if (!demo) {
      setOrders(initialOrders);
      setFilaments(initialFilaments);
    }
  }, [initialOrders, initialFilaments, demo]);
  const admin = member.role === "admin",
    ready = getReadyQueue(orders),
    selected = orders.find((o) => o.id === detail),
    reviews = orders.filter((o) => o.status === "pending");
  function go(next: Screen) {
    setScreen(next);
    setDetail(null);
    setNotice("");
    setEdit(null);
    setSource(null);
    setNote("");
  }
  function open(id: string) {
    setDetail(id);
    setNote("");
    setNotice("");
  }
  function act(task: () => Promise<void>) {
    setNotice("");
    startTransition(async () => {
      try {
        await task();
      } catch (e) {
        setNotice(
          e instanceof Error ? e.message : "Something went wrong. Try again.",
        );
      }
    });
  }
  function change(o: PrintOrder, type: Exclude<OrderAction["type"], "edit">) {
    act(async () => {
      if (
        type === "start" &&
        (ready[0]?.id !== o.id || orders.some((x) => x.status === "printing"))
      )
        throw Error(
          "Finish the current print, then start the oldest ready request.",
        );
      if (demo) {
        const next = transitionOrder(o, { type, note }, member);
        setOrders((v) =>
          v.map((x) =>
            x.id === o.id
              ? {
                  ...next,
                  comments: note
                    ? [
                        ...next.comments,
                        {
                          id: crypto.randomUUID(),
                          author: member.name,
                          body: note,
                          createdAt: new Date().toISOString(),
                        },
                      ]
                    : next.comments,
                }
              : x,
          ),
        );
        setNotice("Demo updated. No email was sent.");
      } else {
        await changeOrder(o.id, o.version, type, note);
        router.refresh();
        setNotice("Order updated.");
      }
      setNote("");
    });
  }
  function reorder(o: PrintOrder) {
    go("request");
    setSource(o);
  }
  const nav = [
    { id: "queue", label: "Family queue", icon: LayoutGrid },
    { id: "mine", label: "My requests", icon: Layers },
    { id: "history", label: "Print history", icon: History },
    { id: "filaments", label: "Filament library", icon: Spool },
    ...(admin
      ? [
          { id: "review", label: "Mom’s review", icon: CheckCheck },
          { id: "settings", label: "Family & settings", icon: Users },
        ]
      : []),
  ];
  const titles: Record<Screen, [string, string]> = {
    queue: [
      "Good things are taking shape.",
      "A little imagination. A place in line.",
    ],
    mine: [
      "Your ideas, in the making.",
      "Every request, from wish list to finished print.",
    ],
    history: [
      "Made with a little love.",
      "The family’s collection of finished prints.",
    ],
    filaments: [
      "Pick your perfect color.",
      "What’s on the shelf and ready for your next idea.",
    ],
    review: [
      "A new idea for your plate.",
      "Review the details, then make room in the queue.",
    ],
    request: [
      "What’s on your wish list?",
      "One MakerWorld model. As much imagination as you like.",
    ],
    settings: [
      "Everyone’s invited. By you.",
      "Your family print shop, your guest list.",
    ],
  };
  function card(o: PrintOrder, badge?: string) {
    return (
      <button key={o.id} className="order-card" onClick={() => open(o.id)}>
        <div className={`model-art art-${artFor(o.title).codePointAt(0)! % 4}`}>
          <span>{artFor(o.title)}</span>
          <span className={`status status-${o.status}`}>
            {badge ?? statusLabels[o.status]}
          </span>
        </div>
        <div className="card-body">
          <div className="card-top">
            <small>FOR {o.recipient.toUpperCase()}</small>
            <ArrowUpRight size={17} />
          </div>
          <h3>{o.title}</h3>
          <p>
            {o.quantity} {o.quantity === 1 ? "copy" : "copies"} <span>·</span>{" "}
            {prettyDate(o.submittedAt)}
          </p>
          <div className="part-preview">
            {o.parts.slice(0, 3).map((p, i) => {
              const f = filaments.find((f) => f.id === p.filamentId);
              return (
                <span key={i} title={`${p.name}: ${f?.name ?? p.special}`}>
                  <i
                    className="swatch"
                    style={{
                      background:
                        f?.color ?? "linear-gradient(45deg,#d6a5d8,#b0cde0)",
                    }}
                  />
                  {f?.name ?? "Special filament"}
                </span>
              );
            })}
          </div>
          {o.status === "on_hold" && (
            <small className="hold-text">{o.holdReason}</small>
          )}
        </div>
      </button>
    );
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("queue");
          }}
        >
          <span className="logo">
            <Printer size={23} />
          </span>
          <span>
            Next on
            <br />
            Mom’s Plate<span className="brand-sub">THE FAMILY PRINT SHOP</span>
          </span>
        </a>
        <button className="primary new-button" onClick={() => go("request")}>
          <Plus size={18} /> Request a print
        </button>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={screen === n.id && !detail ? "active" : ""}
              onClick={() => go(n.id as Screen)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "review" && reviews.length > 0 && (
                <span className="count">{reviews.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-note">
            <Flower2 size={24} />
            <p>
              Big ideas.
              <br />
              One layer at a time.
            </p>
          </div>
          <div className="member">
            <span className="avatar">{member.name[0]}</span>
            <div>
              <strong>{member.name}</strong>
              <small>{admin ? "Mom in charge" : "Family maker"}</small>
            </div>
            {!demo && (
              <form action={signOut}>
                <button aria-label="Sign out">
                  <LogOut size={17} />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="crumb">
            <Printer size={16} /> Our little print shop
          </span>
          <span className="top-pill">
            <span /> {demo ? "DESIGN DEMO" : "FAMILY ACCESS"}
          </span>
        </header>
        {demo && (
          <div className="demo-banner">
            Interactive demo · Sample orders and filaments. Changes last until
            you refresh. No emails are sent.
          </div>
        )}
        <main className="main">
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {selected ? (
            <>
              <button className="back" onClick={() => setDetail(null)}>
                <ChevronLeft size={16} /> Back to{" "}
                {screen === "review" ? "review" : "dashboard"}
              </button>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    FOR {selected.recipient.toUpperCase()}
                  </span>
                  <h1>{selected.title}</h1>
                  <p>
                    Submitted by {selected.submitterName} ·{" "}
                    {prettyDate(selected.submittedAt)}
                  </p>
                </div>
                <span className={`status status-${selected.status}`}>
                  {statusLabels[selected.status]}
                </span>
              </div>
              <div className="detail-grid">
                <section className="panel order-detail">
                  <div
                    className={`detail-art model-art art-${artFor(selected.title).codePointAt(0)! % 4}`}
                  >
                    {artFor(selected.title)}
                  </div>
                  <div className="panel-content">
                    <a
                      className="model-link"
                      href={selected.modelUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open MakerWorld model <ArrowUpRight size={16} />
                    </a>
                    <h2>Print details</h2>
                    <p>
                      {selected.quantity}{" "}
                      {selected.quantity === 1 ? "copy" : "copies"} · For{" "}
                      {selected.recipient}
                    </p>
                    {selected.parts.map((p, i) => {
                      const f = filaments.find((f) => f.id === p.filamentId);
                      return (
                        <div className="part-line" key={i}>
                          <strong>{p.name}</strong>
                          <span>
                            <i
                              className="swatch"
                              style={{ background: f?.color ?? "#b8a2ce" }}
                            />
                            {f?.name ?? p.special}
                          </span>
                        </div>
                      );
                    })}
                    <h3>Personalization & notes</h3>
                    <p className="preserve">
                      {selected.notes || "No extra instructions."}
                    </p>
                    {selected.holdReason && (
                      <p className="hold-box">{selected.holdReason}</p>
                    )}
                    {selected.images.length > 0 && (
                      <div className="references">
                        {selected.images.map((url, i) => (
                          <a
                            href={url}
                            key={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={url} alt={`Reference ${i + 1}`} />
                          </a>
                        ))}
                      </div>
                    )}
                    {selected.status === "completed" && (
                      <button
                        className="primary"
                        onClick={() => reorder(selected)}
                      >
                        <Plus size={17} /> Request again
                      </button>
                    )}
                    {selected.submitterId === member.id &&
                      [
                        "pending",
                        "changes_requested",
                        "queued",
                        "on_hold",
                      ].includes(selected.status) && (
                        <div className="button-row">
                          <button
                            onClick={() => {
                              setEdit(selected);
                              setSource(null);
                              setScreen("request");
                              setDetail(null);
                            }}
                          >
                            Edit request
                          </button>
                          <button
                            disabled={pending}
                            onClick={() => change(selected, "cancel")}
                          >
                            Cancel request
                          </button>
                        </div>
                      )}
                  </div>
                </section>
                <div>
                  {admin && (
                    <section className="panel panel-content">
                      <span className="eyebrow">MOM’S CONTROLS</span>
                      <h2>Make it happen.</h2>
                      <label>
                        Note or reason
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Feedback, a hold reason, or changes needed…"
                          maxLength={4000}
                        />
                      </label>
                      <div className="button-row">
                        {selected.status === "pending" && (
                          <button
                            className="primary"
                            disabled={pending}
                            onClick={() => change(selected, "approve")}
                          >
                            <Check size={16} /> Approve
                          </button>
                        )}
                        {["pending", "queued", "on_hold"].includes(
                          selected.status,
                        ) && (
                          <button
                            disabled={pending}
                            onClick={() => change(selected, "request_changes")}
                          >
                            Request changes
                          </button>
                        )}
                        {[
                          "pending",
                          "changes_requested",
                          "queued",
                          "on_hold",
                        ].includes(selected.status) && (
                          <button
                            disabled={pending}
                            onClick={() => change(selected, "deny")}
                          >
                            Deny
                          </button>
                        )}
                        {selected.status === "queued" && (
                          <button
                            className="primary"
                            disabled={pending}
                            onClick={() => change(selected, "start")}
                          >
                            Start printing
                          </button>
                        )}
                        {["queued", "printing"].includes(selected.status) && (
                          <button
                            disabled={pending}
                            onClick={() => change(selected, "hold")}
                          >
                            Put on hold
                          </button>
                        )}
                        {selected.status === "on_hold" && (
                          <button
                            disabled={pending}
                            onClick={() => change(selected, "release")}
                          >
                            Ready to print
                          </button>
                        )}
                        {selected.status === "printing" && (
                          <>
                            <button
                              className="primary"
                              disabled={pending}
                              onClick={() => change(selected, "complete")}
                            >
                              Mark complete
                            </button>
                            <button
                              disabled={pending}
                              onClick={() => change(selected, "retry")}
                            >
                              Retry print
                            </button>
                          </>
                        )}
                      </div>
                    </section>
                  )}
                  {(admin || selected.submitterId === member.id) && (
                    <section className="panel panel-content discussion">
                      <h2>
                        <MessageCircle size={18} /> Order conversation
                      </h2>
                      {selected.comments.length === 0 ? (
                        <p className="muted">
                          Questions, details, and little updates belong here.
                        </p>
                      ) : (
                        selected.comments.map((c) => (
                          <div className="comment" key={c.id}>
                            <strong>{c.author}</strong>
                            <small>{prettyDate(c.createdAt)}</small>
                            <p className="preserve">{c.body}</p>
                          </div>
                        ))
                      )}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          act(async () => {
                            if (!comment.trim()) return;
                            if (demo)
                              setOrders((v) =>
                                v.map((o) =>
                                  o.id === selected.id
                                    ? {
                                        ...o,
                                        comments: [
                                          ...o.comments,
                                          {
                                            id: crypto.randomUUID(),
                                            author: member.name,
                                            body: comment.trim(),
                                            createdAt: new Date().toISOString(),
                                          },
                                        ],
                                      }
                                    : o,
                                ),
                              );
                            else {
                              await addComment(selected.id, comment);
                              router.refresh();
                            }
                            setComment("");
                          });
                        }}
                      >
                        <label>
                          Add a comment
                          <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            required
                            maxLength={4000}
                          />
                        </label>
                        <button disabled={pending}>Post comment</button>
                      </form>
                    </section>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {screen === "request"
                      ? "A NEW LITTLE IDEA"
                      : `HELLO, ${member.name.toUpperCase()}`}
                  </span>
                  <h1>
                    {edit ? "A little change of plans." : titles[screen][0]}
                  </h1>
                  <p>{titles[screen][1]}</p>
                </div>
                {screen === "queue" && (
                  <button className="primary" onClick={() => go("request")}>
                    <Plus size={18} /> Request a print
                  </button>
                )}
              </div>
              {screen === "queue" && (
                <>
                  {orders.some((o) => o.status === "printing") && (
                    <div className="printing-strip">
                      <span className="printer-bubble">
                        <Printer size={23} />
                      </span>
                      <div>
                        <span className="eyebrow">ON THE BUILD PLATE</span>
                        <button
                          className="printing-order-link"
                          onClick={() =>
                            open(
                              orders.find((o) => o.status === "printing")!.id,
                            )
                          }
                        >
                          {orders
                            .filter((o) => o.status === "printing")
                            .map((o) => `${o.title} for ${o.recipient}`)
                            .join(" · ")}
                        </button>
                      </div>
                      <span className="live-dot">Printing now</span>
                    </div>
                  )}
                  <div className="section-heading">
                    <h2>
                      Up next <span>{ready.length}</span>
                    </h2>
                    <small>In order of original request</small>
                  </div>
                  {ready.length ? (
                    <div className="order-grid">
                      {ready.map((o, i) =>
                        card(o, i === 0 ? "Next ready" : `In line · ${i + 1}`),
                      )}
                    </div>
                  ) : (
                    <Empty text="The queue has room for a little imagination." />
                  )}
                  {orders.some((o) => o.status === "on_hold") && (
                    <>
                      <div className="section-heading">
                        <h2>
                          A little patience{" "}
                          <span>
                            {
                              orders.filter((o) => o.status === "on_hold")
                                .length
                            }
                          </span>
                        </h2>
                        <small>
                          These keep their original place when ready.
                        </small>
                      </div>
                      <div className="order-grid">
                        {orders
                          .filter((o) => o.status === "on_hold")
                          .map((o) => card(o))}
                      </div>
                    </>
                  )}
                  <div className="queue-footer">
                    <Clock size={16} /> Approved requests print first come,
                    first served. If one is waiting, the next ready print goes
                    ahead.
                  </div>
                </>
              )}
              {screen === "mine" && (
                <>
                  <div className="order-grid">
                    {orders
                      .filter((o) => o.submitterId === member.id)
                      .map((o) => card(o))}
                  </div>
                  {!orders.some((o) => o.submitterId === member.id) && (
                    <Empty text="Your next idea starts with a request." />
                  )}
                </>
              )}
              {screen === "history" && (
                <>
                  <div className="order-grid">
                    {orders
                      .filter((o) => o.status === "completed")
                      .map((o) => card(o))}
                  </div>
                  {!orders.some((o) => o.status === "completed") && (
                    <Empty text="The first finished print will appear here." />
                  )}
                </>
              )}
              {screen === "review" && (
                <>
                  <div className="order-grid">
                    {reviews.map((o) => card(o))}
                  </div>
                  {!reviews.length && (
                    <Empty text="All caught up. Your plate is looking good." />
                  )}
                </>
              )}
              {screen === "request" && (
                <RequestForm
                  key={edit?.id ?? source?.id ?? "new"}
                  initial={edit ?? source}
                  editing={!!edit}
                  filaments={filaments}
                  recipients={recipients}
                  pending={pending}
                  onSubmit={(input, files) =>
                    act(async () => {
                      const validated = validateRequest(input);
                      validateFilaments(validated, filaments);
                      let id: string;
                      if (demo) {
                        id = edit?.id ?? crypto.randomUUID();
                        const next: PrintOrder = edit
                          ? transitionOrder(
                              edit,
                              { type: "edit", input: validated },
                              member,
                            )
                          : {
                              ...validated,
                              id,
                              submittedAt: new Date().toISOString(),
                              submitterId: member.id,
                              submitterName: member.name,
                              status: "pending",
                              version: 1,
                              holdReason: "",
                              comments: [],
                              images: [],
                            };
                        setOrders((v) =>
                          edit
                            ? v.map((o) => (o.id === id ? next : o))
                            : [...v, next],
                        );
                        setNotice(
                          "Demo request saved in this preview. No email was sent.",
                        );
                      } else {
                        id = await saveOrder(
                          edit?.id ?? null,
                          edit?.version ?? 0,
                          validated,
                        );
                        if (files.length) {
                          const form = new FormData();
                          files.forEach((f) => form.append("images", f));
                          try {
                            await uploadReferences(id, form);
                          } catch (e) {
                            setDetail(id);
                            setScreen("mine");
                            router.refresh();
                            throw e;
                          }
                        }
                        await sendPendingNotifications();
                        router.refresh();
                        setNotice("Your request is awaiting Mom’s approval.");
                      }
                      setEdit(null);
                      setSource(null);
                      setScreen("mine");
                      setDetail(id);
                    })
                  }
                />
              )}
              {screen === "filaments" && (
                <>
                  <div className="filament-grid">
                    {filaments.map((f) => (
                      <div className="filament-card panel" key={f.id}>
                        <div
                          className="spool-art"
                          style={
                            { "--spool-color": f.color } as React.CSSProperties
                          }
                        >
                          <Spool size={65} strokeWidth={1.3} />
                        </div>
                        <div className="panel-content">
                          <span className="eyebrow">
                            {f.brand || "FILAMENT"} · {f.material}
                          </span>
                          <h3>{f.name}</h3>
                          <span
                            className={`availability ${f.available ? "available" : ""}`}
                          >
                            <i />
                            {f.available ? "Available" : "Unavailable"}
                          </span>
                          {admin && (
                            <button
                              className="stock-toggle"
                              disabled={pending}
                              onClick={() =>
                                act(async () => {
                                  if (demo)
                                    setFilaments((v) =>
                                      v.map((x) =>
                                        x.id === f.id
                                          ? { ...x, available: !x.available }
                                          : x,
                                      ),
                                    );
                                  else {
                                    await saveFilament({
                                      ...f,
                                      available: !f.available,
                                    });
                                    router.refresh();
                                  }
                                })
                              }
                            >
                              Mark {f.available ? "unavailable" : "available"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="queue-footer">
                    <Sparkles size={16} /> Dreaming of a different finish?
                    Request a special filament when placing your order.
                  </div>
                  {admin && (
                    <FilamentForm
                      pending={pending}
                      onSave={(f) =>
                        act(async () => {
                          if (demo)
                            setFilaments((v) => [
                              ...v,
                              { ...f, id: crypto.randomUUID() },
                            ]);
                          else {
                            await saveFilament(f);
                            router.refresh();
                          }
                          setNotice("Filament added.");
                        })
                      }
                    />
                  )}
                </>
              )}
              {screen === "settings" && admin && (
                <div className="settings-grid">
                  <section className="panel panel-content">
                    <h2>Invite a family maker</h2>
                    <p>They’ll get an email to set up their account.</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        act(async () => {
                          if (demo)
                            setNotice("Demo only. No invitation was sent.");
                          else
                            setNotice(
                              await inviteMember(
                                String(form.get("email")),
                                String(form.get("name")),
                              ),
                            );
                        });
                      }}
                    >
                      <label>
                        Name
                        <input name="name" required maxLength={100} />
                      </label>
                      <label>
                        Email
                        <input name="email" type="email" required />
                      </label>
                      <button className="primary" disabled={pending}>
                        Send invitation
                      </button>
                    </form>
                  </section>
                  <section className="panel panel-content">
                    <h2>Keep everyone in the loop</h2>
                    <p>
                      Notifications go to you for reviews and to the submitter
                      for decisions and finished prints.
                    </p>
                    <button
                      disabled={pending}
                      onClick={() =>
                        act(async () => {
                          if (demo) {
                            setNotice("Demo only. No emails were sent.");
                            return;
                          }
                          const result = await retryEmails();
                          setNotice(
                            result.configured
                              ? `${result.sent} sent, ${result.pending} pending. ${result.needsReview} need provider reconciliation; check delivery logs before resetting them.`
                              : "Email sending is not configured yet.",
                          );
                        })
                      }
                    >
                      Retry pending emails
                    </button>
                    <div className="soft-note">
                      Sofia can be selected as a recipient. Someone else submits
                      on her behalf.
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer className="footer">
          <Flower2 size={15} /> Made for our family. One layer at a time.
        </footer>
      </div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <PackageOpen size={36} />
      <p>{text}</p>
    </div>
  );
}
function RequestForm({
  initial,
  editing,
  filaments,
  recipients,
  pending,
  onSubmit,
}: {
  initial: PrintOrder | null;
  editing: boolean;
  filaments: Filament[];
  recipients: string[];
  pending: boolean;
  onSubmit: (input: unknown, files: File[]) => void;
}) {
  const [parts, setParts] = useState<Part[]>(
    initial?.parts.map((p) => ({ ...p })) ?? [
      { name: "Whole print", filamentId: "", special: "" },
    ],
  );
  const [files, setFiles] = useState<File[]>([]),
    [fileError, setFileError] = useState("");
  return (
    <form
      className="request-layout"
      onSubmit={(e) => {
        e.preventDefault();
        if (fileError) return;
        const f = new FormData(e.currentTarget);
        onSubmit(
          {
            title: f.get("title"),
            modelUrl: f.get("modelUrl"),
            recipient: f.get("recipient"),
            quantity: Number(f.get("quantity")),
            notes: f.get("notes"),
            parts,
          },
          files,
        );
      }}
    >
      <section className="panel panel-content">
        <h2>
          <span className="step">1</span> The idea
        </h2>
        <label>
          What are we making?
          <input
            name="title"
            defaultValue={initial?.title}
            placeholder="Give your print a name"
            required
            maxLength={160}
          />
        </label>
        <label>
          MakerWorld model link
          <input
            name="modelUrl"
            type="url"
            defaultValue={initial?.modelUrl}
            readOnly={editing}
            placeholder="https://makerworld.com/en/models/…"
            required
          />
        </label>
        {editing && <small>A different model needs a new request.</small>}
        <div className="two">
          <label>
            Who’s it for?
            <select
              name="recipient"
              defaultValue={initial?.recipient ?? recipients[0]}
            >
              {recipients.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>
            How many copies?
            <input
              name="quantity"
              type="number"
              min={1}
              max={100}
              defaultValue={initial?.quantity ?? 1}
              required
            />
          </label>
        </div>
        <h2>
          <span className="step">2</span> Make it yours
        </h2>
        <p className="muted">
          Name the parts and choose a filament for each. One color all over?
          Keep “Whole print.”
        </p>
        {parts.map((part, i) => (
          <div className="part-input" key={i}>
            <label>
              Part name
              <input
                value={part.name}
                maxLength={100}
                required
                onChange={(e) =>
                  setParts((v) =>
                    v.map((p, j) =>
                      j === i ? { ...p, name: e.target.value } : p,
                    ),
                  )
                }
              />
            </label>
            <label>
              Filament
              <select
                required
                value={
                  part.special || part.filamentId === "special"
                    ? "special"
                    : part.filamentId
                }
                onChange={(e) =>
                  setParts((v) =>
                    v.map((p, j) =>
                      j === i
                        ? {
                            ...p,
                            filamentId:
                              e.target.value === "special"
                                ? "special"
                                : e.target.value,
                            special: "",
                          }
                        : p,
                    ),
                  )
                }
              >
                <option value="">Choose a filament</option>
                {filaments.map((f) => (
                  <option value={f.id} disabled={!f.available} key={f.id}>
                    {f.name} · {f.material}
                    {!f.available ? " (unavailable)" : ""}
                  </option>
                ))}
                <option value="special">Request special filament</option>
              </select>
            </label>
            {(part.special || part.filamentId === "special") && (
              <label className="full-width">
                What filament would you like?
                <input
                  value={part.special}
                  maxLength={500}
                  required
                  placeholder="Color, material, and optional product link"
                  onChange={(e) =>
                    setParts((v) =>
                      v.map((p, j) =>
                        j === i
                          ? {
                              ...p,
                              filamentId: e.target.value ? "" : "special",
                              special: e.target.value,
                            }
                          : p,
                      ),
                    )
                  }
                />
              </label>
            )}
            {parts.length > 1 && (
              <button
                type="button"
                className="remove-part"
                onClick={() => setParts((v) => v.filter((_, j) => j !== i))}
              >
                Remove part {i + 1}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setParts((v) => [...v, { name: "", filamentId: "", special: "" }])
          }
          disabled={parts.length >= 40}
        >
          <Plus size={16} /> Add another part
        </button>
        <label className="notes-label">
          Personalization & other details
          <textarea
            name="notes"
            defaultValue={initial?.notes}
            rows={4}
            maxLength={4000}
            placeholder="Names, sizes, model variations, different colors for each copy… tell Mom what you have in mind."
          />
        </label>
        <label>
          Reference images <span className="muted">(optional)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => {
              const items = Array.from(e.target.files ?? []);
              setFiles(items);
              setFileError(
                items.length > 5 ||
                  items.reduce((sum, f) => sum + f.size, 0) > 3 * 1024 * 1024
                  ? "Choose up to five images totaling under 3 MB."
                  : "",
              );
            }}
          />
        </label>
        {fileError && <p role="alert">{fileError}</p>}
      </section>
      <aside className="request-aside">
        <section className="panel panel-content">
          <span className="eyebrow">A LITTLE HEADS-UP</span>
          <h2>Mom gets the final say.</h2>
          <p>
            Your request goes to Mom for review before entering the print queue.
          </p>
          <ul>
            <li>Approved requests keep their original submission time.</li>
            <li>Waiting for filament? The next ready print goes ahead.</li>
            <li>You can make changes before printing starts.</li>
          </ul>
          <button
            className="primary submit-request"
            disabled={pending || !!fileError}
          >
            {pending
              ? "Saving…"
              : editing
                ? "Send updated request"
                : "Send to Mom for approval"}
            <ArrowUpRight size={17} />
          </button>
        </section>
      </aside>
    </form>
  );
}
function FilamentForm({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (f: Omit<Filament, "id">) => void;
}) {
  return (
    <section className="panel panel-content add-filament">
      <h2>Add to the filament shelf</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSave({
            name: String(f.get("name")),
            brand: String(f.get("brand")),
            material: String(f.get("material")),
            color: String(f.get("color")),
            available: true,
          });
        }}
      >
        <div className="two">
          <label>
            Color / filament name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Brand
            <input name="brand" maxLength={100} />
          </label>
          <label>
            Material
            <input name="material" defaultValue="PLA" required maxLength={50} />
          </label>
          <label>
            Color swatch
            <input name="color" type="color" defaultValue="#b49bd0" />
          </label>
        </div>
        <button className="primary" disabled={pending}>
          Add filament
        </button>
      </form>
    </section>
  );
}
