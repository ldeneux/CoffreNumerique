"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Search,
  X,
  LogOut,
  Users,
  FolderOpen,
  Settings as SettingsIcon,
  Check,
  Download,
  FileText,
  Phone,
  Mail,
  MapPin,
  Cake,
  Building2,
  AlertTriangle,
  UploadCloud,
  Star,
  Pin,
  Syringe,
  Loader2,
  CalendarDays,
  CheckSquare,
  Square,
  PartyPopper,
} from "lucide-react";
import { supabase, DOCUMENTS_BUCKET } from "../lib/supabaseClient";
import { parseVCardFile } from "../lib/vcard";

const GENERAL_LABEL = "Général";

// Palette fixe : les classes sont écrites en toutes lettres ci-dessous pour
// que Tailwind les détecte à la compilation (jamais de bg-${x}-500 dynamique,
// qui ne génère aucune classe et rend des badges invisibles).
const PALETTE = ["blue", "emerald", "rose", "amber", "violet", "teal", "fuchsia", "cyan", "indigo", "stone"];

// Emoji des membres de la famille : une base de silhouettes, complétée par le
// choix demandé (animaux, fantaisie...) réservé aux membres de la famille.
const FAMILY_EMOJI_BASE = ["\u{1F464}", "\u{1F9D1}", "\u{1F468}", "\u{1F469}", "\u{1F9D2}", "\u{1F466}", "\u{1F467}", "\u{1F476}", "\u{1F474}", "\u{1F475}"];
const FAMILY_EMOJI_EXTRA = ["\u{1F98A}", "\u{1F43C}", "\u{1F984}", "\u{1F99C}", "\u{1F426}\u200D\u{1F525}", "\u{1F438}", "\u{1F420}", "\u{1F98B}", "\u{1F99A}", "\u{1F430}", "\u{1F333}", "\u{1F33A}", "\u{1F36C}", "\u{1F370}", "\u{1F9D1}\u200D\u{1F680}", "\u{1FA90}", "\u{1F349}", "\u{1F525}", "\u{1F9D9}\u200D\u2640\uFE0F", "\u{1F52E}", "\u{1F428}", "\u{1F41E}", "\u{1F344}", "\u{1F308}", "\u{1F496}", "\u2728", "\u{1F31F}", "\u{1F9C1}", "\u{1F353}", "\u{1F4AB}"];
const FAMILY_EMOJI_OPTIONS = [...FAMILY_EMOJI_BASE, ...FAMILY_EMOJI_EXTRA];

// Emoji des types de document : un jeu adapté aux pièces administratives
// courantes (identité, véhicule, logement, banque, santé...).
const DOCUMENT_EMOJI_OPTIONS = ["\u{1FAAA}", "\u{1F697}", "\u{1F698}", "\u{1F3E0}", "\u{1F4DC}", "\u{1F4CB}", "\u{1F393}", "\u{1F9FE}", "\u{1F3E6}", "\u271D\uFE0F", "\u{1F489}", "\u{1F4B6}", "\u{1F6C2}", "\u{1F4C4}", "\u{1F4C1}", "\u{1F5C2}\uFE0F", "\u{1F4D1}", "\u{1F3E5}", "\u2696\uFE0F", "\u{1F3AB}"];
const SWATCH_BG = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  fuchsia: "bg-fuchsia-500",
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
  stone: "bg-stone-500",
};
const BADGE_CLASSES = {
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rose: "bg-rose-50 text-rose-800 border-rose-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  violet: "bg-violet-50 text-violet-800 border-violet-200",
  teal: "bg-teal-50 text-teal-800 border-teal-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
  stone: "bg-stone-50 text-stone-700 border-stone-200",
};

function normalizeStr(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
function contactDisplayName(c) {
  if (c.societe && c.societe.trim()) return c.societe.trim();
  return [c.nom, c.prenom].filter(Boolean).join(" ").trim() || "(Sans nom)";
}
function contactSortKey(c) {
  return normalizeStr(c.societe ? c.societe : `${c.nom || ""} ${c.prenom || ""}`);
}
// Titre affiché sur la ligne : "NOM Prénom (alias)" — l'alias n'apparaît que s'il est renseigné.
function contactTitle(c) {
  const alias = (c.alias || "").trim();
  return alias ? `${contactDisplayName(c)} (${alias})` : contactDisplayName(c);
}
// "Général" (type de contact ou activité) : valeur par défaut, jamais affichée en badge.
function isGeneralName(name) {
  return normalizeStr(name) === normalizeStr(GENERAL_LABEL);
}
// Nom d'un membre de la famille précédé de son emoji, si renseigné.
function memberLabel(member) {
  if (!member) return GENERAL_LABEL;
  return member.emoji ? `${member.emoji} ${member.name}` : member.name;
}
// Nom d'un type (document...) précédé de son emoji, si renseigné.
function typeLabel(type) {
  if (!type) return "—";
  return type.emoji ? `${type.emoji} ${type.name}` : type.name;
}

// Téléphone au format international compact (+33612345678), utilisé pour la copie.
// 06 12 34 56 78 -> +33612345678 ; 0033 6... -> +336... ; +33 (0)6... -> +336...
function toInternationalPhone(raw) {
  if (!raw) return "";
  let t = String(raw).trim().replace(/[\s.\-()/]/g, "");
  if (!t) return "";
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (t.startsWith("+330")) t = "+33" + t.slice(4);
  else if (!t.startsWith("+") && /^0\d{9}$/.test(t)) t = "+33" + t.slice(1);
  return t;
}
// Même numéro, groupé pour la lecture : +33 6 12 34 56 78 (autres pays : format compact).
function formatPhoneDisplay(raw) {
  const intl = toInternationalPhone(raw);
  const m = intl.match(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+33 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : intl || String(raw || "");
}
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    /* on retombe sur la méthode de secours ci-dessous */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}
function formatDateFR(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(dt);
}
function daysUntil(d) {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
function fileExtIcon() {
  return <FileText size={15} />;
}

// Fenêtre "3 prochains mois" (mois en cours + 2 suivants) utilisée par l'onglet Événements
function eventsWindow() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0); // dernier jour du mois+2
  end.setHours(23, 59, 59, 999);
  return { start: today, end };
}
function nextBirthdayOccurrence(dateNaissance, today) {
  if (!dateNaissance) return null;
  const d = new Date(dateNaissance + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  let occ = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (occ < today) occ = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  return { date: occ, turningAge: occ.getFullYear() - d.getFullYear() };
}
function formatDayMonthFR(d) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long" }).format(d);
}

const NAV_ITEMS = [
  { key: "events", label: "Événements", icon: CalendarDays },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "documents", label: "Documents", icon: FolderOpen },
  { key: "sante", label: "Santé", icon: Syringe },
];

export default function CoffreApp({ session }) {
  const [activeTab, setActiveTab] = useState("contacts");
  const [familyMembers, setFamilyMembers] = useState([]);
  const [contactTypes, setContactTypes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: fm }, { data: ct }, { data: ac }, { data: dt }, { data: cs }, { data: docs }, { data: vx }] = await Promise.all([
        supabase.from("family_members").select("*").order("name", { ascending: true }),
        supabase.from("contact_types").select("*").order("name", { ascending: true }),
        supabase.from("activities").select("*").order("name", { ascending: true }),
        supabase.from("document_types").select("*").order("name", { ascending: true }),
        supabase.from("contacts").select("*"),
        supabase.from("documents").select("*"),
        supabase.from("vaccinations").select("*"),
      ]);
      setFamilyMembers(fm || []);
      setContactTypes(ct || []);
      setActivities(ac || []);
      setDocumentTypes(dt || []);
      setContacts(cs || []);
      setDocuments(docs || []);
      setVaccinations(vx || []);
      setErrorMsg("");
    } catch (e) {
      setErrorMsg("Impossible de charger les données. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("coffre-changes")
      .on("postgres_changes", { event: "*", schema: "coffre", table: "contacts" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "documents" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "vaccinations" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "family_members" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "contact_types" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "activities" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "coffre", table: "document_types" }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  const familyMemberById = useMemo(() => {
    const map = {};
    familyMembers.forEach((m) => (map[m.id] = m));
    return map;
  }, [familyMembers]);
  const contactTypeById = useMemo(() => {
    const map = {};
    contactTypes.forEach((t) => (map[t.id] = t));
    return map;
  }, [contactTypes]);
  const activityById = useMemo(() => {
    const map = {};
    activities.forEach((a) => (map[a.id] = a));
    return map;
  }, [activities]);
  const documentTypeById = useMemo(() => {
    const map = {};
    documentTypes.forEach((t) => (map[t.id] = t));
    return map;
  }, [documentTypes]);
  const emergencyContacts = useMemo(
    () => contacts.filter((c) => c.numero_urgence).sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b), "fr")),
    [contacts]
  );
  const pinnedContacts = useMemo(
    () => contacts.filter((c) => c.epingle).sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b), "fr")),
    [contacts]
  );

  if (loading) {
    return <div className="w-full min-h-screen flex items-center justify-center text-stone-400 text-sm font-sans">Chargement du coffre numérique…</div>;
  }

  // --- Contacts ---
  async function saveContact(fields, existingId) {
    const payload = {
      contact_type_id: fields.contactTypeId,
      activity_id: fields.activityId || null,
      family_member_id: fields.familyMemberId || null,
      nom: fields.nom,
      alias: fields.alias || "",
      numero_urgence: !!fields.numeroUrgence,
      epingle: !!fields.epingle,
      prenom: fields.prenom,
      societe: fields.societe,
      telephone_mobile: fields.telephoneMobile,
      telephone_fixe: fields.telephoneFixe,
      email: fields.email,
      adresse: fields.adresse,
      code_postal: fields.codePostal,
      ville: fields.ville,
      date_naissance: fields.dateNaissance || null,
      favori: !!fields.favori,
      notes: fields.notes,
    };
    const { error } = existingId
      ? await supabase.from("contacts").update(payload).eq("id", existingId)
      : await supabase.from("contacts").insert(payload);
    if (error) { setErrorMsg("Impossible d'enregistrer ce contact."); return false; }
    fetchAll();
    return true;
  }
  async function deleteContact(id) {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) setErrorMsg("Impossible de supprimer ce contact.");
    else fetchAll();
  }
  // Insertion ligne par ligne : une fiche invalide (ex: numéro de téléphone
  // mal formé, doublon...) ne doit pas bloquer l'import des autres.
  async function importContacts(rows) {
    let successCount = 0;
    const failures = [];
    const generalActivityId = activities.find((a) => isGeneralName(a.name))?.id || null;
    for (const r of rows) {
      const payload = {
        contact_type_id: r.contactTypeId,
        activity_id: generalActivityId,
        family_member_id: r.familyMemberId || null,
        nom: r.lastName,
        prenom: r.firstName,
        societe: r.org,
        telephone_mobile: r.mobile,
        telephone_fixe: r.phone2,
        email: r.email,
        adresse: r.address?.street || "",
        code_postal: r.address?.postalCode || "",
        ville: r.address?.city || "",
        date_naissance: r.birthday || null,
        notes: "",
      };
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) failures.push({ id: r.id, message: error.message });
      else successCount++;
    }
    fetchAll();
    return { successCount, failures };
  }

  // --- Documents ---
  async function saveDocument(fields, existingId, previousFile) {
    let filePath = previousFile?.file_path || null;
    let fileName = previousFile?.file_name || null;
    if (fields.file) {
      if (previousFile?.file_path) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([previousFile.file_path]);
      }
      const folder = fields.familyMemberId || "general";
      const safeName = fields.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${folder}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, fields.file, { upsert: true });
      if (uploadError) { setErrorMsg("Impossible d'envoyer le fichier."); return false; }
      filePath = path;
      fileName = fields.file.name;
    }
    const payload = {
      document_type_id: fields.documentTypeId,
      family_member_id: fields.familyMemberId || null,
      libelle: fields.libelle,
      date_document: fields.dateDocument || null,
      date_fin_validite: fields.dateFinValidite || null,
      file_path: filePath,
      file_name: fileName,
    };
    const { error } = existingId
      ? await supabase.from("documents").update(payload).eq("id", existingId)
      : await supabase.from("documents").insert(payload);
    if (error) { setErrorMsg("Impossible d'enregistrer ce document."); return false; }
    fetchAll();
    return true;
  }
  async function deleteDocument(doc) {
    if (doc.file_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) setErrorMsg("Impossible de supprimer ce document.");
    else fetchAll();
  }
  // --- Carnet de santé ---
  async function saveVaccination(fields, existingId) {
    const payload = {
      family_member_id: fields.familyMemberId,
      vaccine_name: fields.vaccineName,
      date_administered: fields.dateAdministered || null,
      lot_number: fields.lotNumber || "",
      dose_label: fields.doseLabel || "",
      source_document_id: fields.sourceDocumentId || null,
      notes: fields.notes || "",
    };
    const { error } = existingId
      ? await supabase.from("vaccinations").update(payload).eq("id", existingId)
      : await supabase.from("vaccinations").insert(payload);
    if (error) { setErrorMsg("Impossible d'enregistrer cette vaccination."); return false; }
    fetchAll();
    return true;
  }
  async function deleteVaccination(id) {
    const { error } = await supabase.from("vaccinations").delete().eq("id", id);
    if (error) setErrorMsg("Impossible de supprimer cette entrée.");
    else fetchAll();
  }
  // Enregistrement groupé après relecture par l'utilisateur des lignes extraites
  // d'un scan de carnet de santé (voir extract-health-record). Rien n'est
  // jamais inséré avant cette validation manuelle.
  async function importVaccinations(familyMemberId, rows, sourceDocumentId) {
    let successCount = 0;
    for (const r of rows) {
      const payload = {
        family_member_id: familyMemberId,
        vaccine_name: r.vaccineName,
        date_administered: r.dateAdministered || null,
        lot_number: r.lotNumber || "",
        dose_label: r.doseLabel || "",
        source_document_id: sourceDocumentId || null,
        notes: r.notes || "",
      };
      const { error } = await supabase.from("vaccinations").insert(payload);
      if (!error) successCount++;
    }
    fetchAll();
    return successCount;
  }
  // Appelle la fonction Supabase Edge "extract-health-record" (voir
  // supabase/functions/extract-health-record) qui elle-même appelle l'API
  // Gemini. Nécessite que la clé GEMINI_API_KEY soit configurée côté Supabase
  // (voir README) : sans ça, cet appel renvoie une erreur claire.
  async function extractHealthRecord(base64, mimeType) {
    const { data, error } = await supabase.functions.invoke("extract-health-record", {
      body: { base64, mimeType },
    });
    if (error) {
      let detail = error.message || "";
      try { const body = await error.context?.json?.(); if (body?.error) detail = body.error; } catch (e) { /* ignore */ }
      throw new Error(detail || "La lecture automatique du scan a échoué.");
    }
    if (!data?.entries) throw new Error("Réponse inattendue de l'extraction.");
    return data.entries;
  }

  async function downloadDocument(doc) {
    if (!doc.file_path) return;
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.file_path, 120);
    if (error || !data?.signedUrl) { setErrorMsg("Impossible de générer le lien de téléchargement."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  // --- Paramétrage : listes de référence ---
  async function addRef(table, name, emoji) {
    const payload = emoji !== undefined ? { name, emoji: emoji || null } : { name };
    const { error } = await supabase.from(table).insert(payload);
    if (error) setErrorMsg("Impossible d'ajouter cet élément.");
    else fetchAll();
  }
  async function updateRefEmoji(table, id, emoji) {
    const { error } = await supabase.from(table).update({ emoji: emoji || null }).eq("id", id);
    if (error) setErrorMsg("Impossible de modifier l'emoji.");
    else fetchAll();
  }
  async function addColoredRef(table, name, color) {
    const { error } = await supabase.from(table).insert({ name, color: color || "stone" });
    if (error) setErrorMsg("Impossible d'ajouter cet élément.");
    else fetchAll();
  }
  async function updateRef(table, id, name) {
    const { error } = await supabase.from(table).update({ name }).eq("id", id);
    if (error) setErrorMsg("Impossible de modifier cet élément.");
    else fetchAll();
  }
  async function removeRef(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return false;
    fetchAll();
    return true;
  }
  async function updateRefColor(table, id, color) {
    const { error } = await supabase.from(table).update({ color }).eq("id", id);
    if (error) setErrorMsg("Impossible de modifier la couleur.");
    else fetchAll();
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="w-full min-h-screen bg-stone-50 font-sans text-stone-900 flex">
      <aside className="w-56 shrink-0 bg-stone-100 border-r border-stone-200 min-h-screen p-4 hidden sm:flex flex-col">
        <div className="mb-6 px-1 flex flex-col items-center text-center gap-2">
          <img src="/icon.svg" alt="" width={80} height={80} className="shrink-0" />
          <div className="min-w-0">
            <p className="font-serif text-lg text-blue-950 leading-tight">Coffre numérique</p>
            <p className="text-xs text-stone-500 truncate">{session.user.email}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md ${
                  active ? "bg-blue-950 text-white" : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 mt-2 border-t border-stone-200">
            <button
              onClick={() => setActiveTab("settings")}
              className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md ${
                activeTab === "settings" ? "bg-stone-700 text-white" : "text-stone-500 hover:bg-stone-200"
              }`}
            >
              <SettingsIcon size={16} /> Paramétrage
            </button>
          </div>
        </nav>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 mt-1">
          <QuickDialSection title="Numéros d'urgence" icon={AlertTriangle} contacts={emergencyContacts} accent="text-rose-500" />
          <QuickDialSection title="Contacts épinglés" icon={Pin} contacts={pinnedContacts} accent="text-blue-800" />
        </div>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-stone-500 px-3 py-2 rounded-md hover:bg-stone-200 shrink-0">
          <LogOut size={16} /> Déconnexion
        </button>
      </aside>

      <div className="sm:hidden fixed bottom-0 inset-x-0 bg-stone-100 border-t border-stone-200 flex z-10">
        {[...NAV_ITEMS, { key: "settings", label: "Paramétrage", icon: SettingsIcon }].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${active ? (item.key === "settings" ? "text-stone-700" : "text-blue-950") : "text-stone-500"}`}
            >
              <Icon size={18} />
              {item.label.split(" ")[0]}
            </button>
          );
        })}
      </div>

      <main className="flex-1 min-w-0 pb-16 sm:pb-0">
        {errorMsg && (
          <div className="m-5 sm:m-8 sm:mb-0 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 flex items-start justify-between gap-3">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-600 shrink-0"><X size={14} /></button>
          </div>
        )}

        {(emergencyContacts.length > 0 || pinnedContacts.length > 0) && (
          <div className="sm:hidden m-5 mb-0 bg-white rounded-lg border border-stone-200 p-3">
            <QuickDialSection title="Numéros d'urgence" icon={AlertTriangle} contacts={emergencyContacts} accent="text-rose-500" />
            <QuickDialSection title="Contacts épinglés" icon={Pin} contacts={pinnedContacts} accent="text-blue-800" />
          </div>
        )}

        {activeTab === "events" && (
          <EventsTab
            contacts={contacts}
            documents={documents}
            familyMemberById={familyMemberById}
            documentTypeById={documentTypeById}
            onGoToContacts={() => setActiveTab("contacts")}
          />
        )}

        {activeTab === "contacts" && (
          <ContactsTab
            contacts={contacts}
            contactTypes={contactTypes}
            activities={activities}
            familyMembers={familyMembers}
            contactTypeById={contactTypeById}
            activityById={activityById}
            onSave={saveContact}
            onDelete={deleteContact}
          />
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            documents={documents}
            documentTypes={documentTypes}
            familyMembers={familyMembers}
            documentTypeById={documentTypeById}
            familyMemberById={familyMemberById}
            onSave={saveDocument}
            onDelete={deleteDocument}
            onDownload={downloadDocument}
          />
        )}

        {activeTab === "sante" && (
          <HealthTab
            familyMembers={familyMembers}
            vaccinations={vaccinations}
            documents={documents}
            documentTypes={documentTypes}
            onSaveVaccination={saveVaccination}
            onDeleteVaccination={deleteVaccination}
            onImportVaccinations={importVaccinations}
            onExtractHealthRecord={extractHealthRecord}
            onSaveDocument={saveDocument}
          />
        )}

        {activeTab === "settings" && (
          <CoffreSettingsTab
            familyMembers={familyMembers}
            contactTypes={contactTypes}
            activities={activities}
            documentTypes={documentTypes}
            contacts={contacts}
            documents={documents}
            onAddRef={addRef}
            onAddColoredRef={addColoredRef}
            onUpdateRef={updateRef}
            onRemoveRef={removeRef}
            onUpdateRefColor={updateRefColor}
            onUpdateRefEmoji={updateRefEmoji}
            onImportContacts={importContacts}
          />
        )}
      </main>
    </div>
  );
}

function TypeBadge({ type }) {
  if (!type) return null;
  const cls = BADGE_CLASSES[type.color] || BADGE_CLASSES.stone;
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${cls}`}>{type.name}</span>;
}

// Numéro au format international ; un clic (ou Entrée) le copie dans le presse-papiers.
function PhoneCopy({ value }) {
  const [copied, setCopied] = useState(false);
  const intl = toInternationalPhone(value);
  if (!intl) return null;
  async function handleCopy(e) {
    e.stopPropagation();
    if (await copyToClipboard(intl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <span
      role="button"
      tabIndex={0}
      title="Cliquer pour copier le numéro"
      onClick={handleCopy}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopy(e); } }}
      className="cursor-pointer hover:text-blue-800 hover:underline"
    >
      {copied ? <span className="text-emerald-600 no-underline">Numéro copié ✓</span> : formatPhoneDisplay(value)}
    </span>
  );
}

// Ligne "numéro d'urgence" / "contact épinglé" : affiche le nom, révèle le
// numéro (et le copie) au clic, puis revient au nom au bout de 5 secondes.
function QuickDialItem({ contact }) {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  const phone = contact.telephone_mobile || contact.telephone_fixe;

  async function handleClick() {
    if (!phone) return;
    await copyToClipboard(toInternationalPhone(phone));
    setRevealed(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRevealed(false), 5000);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!phone}
      title={phone ? "Cliquer pour copier le numéro" : "Aucun téléphone enregistré"}
      className={`w-full flex items-center justify-between gap-2 text-left text-xs px-2 py-1.5 rounded-md ${
        phone ? "text-stone-600 hover:bg-stone-200" : "text-stone-300 cursor-default"
      }`}
    >
      <span className="truncate">{revealed ? formatPhoneDisplay(phone) : contactDisplayName(contact)}</span>
      {revealed && <Check size={13} className="text-emerald-600 shrink-0" />}
    </button>
  );
}
function QuickDialSection({ title, icon: Icon, contacts, accent }) {
  if (contacts.length === 0) return null;
  return (
    <div className="mb-2">
      <p className={`px-2 mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400 flex items-center gap-1.5`}>
        <Icon size={12} className={accent} /> {title}
      </p>
      <div>
        {contacts.map((c) => <QuickDialItem key={c.id} contact={c} />)}
      </div>
    </div>
  );
}

// Lit un fichier (image/PDF) et renvoie son contenu en base64 (sans le
// préfixe data:...;base64, retiré) pour l'envoyer à la fonction d'extraction.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function MemberBadge({ member }) {
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full border bg-stone-100 text-stone-600 border-stone-200">
      {memberLabel(member)}
    </span>
  );
}

/* ---------------------------- Contacts ---------------------------- */

function ContactsTab({ contacts, contactTypes, activities, familyMembers, contactTypeById, activityById, onSave, onDelete }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterActivity, setFilterActivity] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [openId, setOpenId] = useState(null);

  // Base commune pour les bascules rapides (favori / urgence / épinglé) :
  // on repart de la fiche telle quelle et on ne change que le champ visé.
  function baseFieldsFrom(c) {
    return {
      contactTypeId: c.contact_type_id,
      activityId: c.activity_id,
      familyMemberId: c.family_member_id,
      alias: c.alias,
      nom: c.nom,
      prenom: c.prenom,
      societe: c.societe,
      telephoneMobile: c.telephone_mobile,
      telephoneFixe: c.telephone_fixe,
      email: c.email,
      adresse: c.adresse,
      codePostal: c.code_postal,
      ville: c.ville,
      dateNaissance: c.date_naissance,
      notes: c.notes,
      favori: c.favori,
      numeroUrgence: c.numero_urgence,
      epingle: c.epingle,
    };
  }
  function toggleFavori(c, e) {
    e.stopPropagation();
    onSave({ ...baseFieldsFrom(c), favori: !c.favori }, c.id);
  }
  function toggleUrgence(c, e) {
    e.stopPropagation();
    onSave({ ...baseFieldsFrom(c), numeroUrgence: !c.numero_urgence }, c.id);
  }
  function toggleEpingle(c, e) {
    e.stopPropagation();
    onSave({ ...baseFieldsFrom(c), epingle: !c.epingle }, c.id);
  }

  const filtered = useMemo(() => {
    const q = normalizeStr(search);
    return contacts
      .filter((c) => {
        if (filterType && c.contact_type_id !== filterType) return false;
        if (filterActivity && c.activity_id !== filterActivity) return false;
        if (filterMember === "__general__" && c.family_member_id) return false;
        if (filterMember && filterMember !== "__general__" && c.family_member_id !== filterMember) return false;
        if (!q) return true;
        const haystack = normalizeStr(
          [c.nom, c.prenom, c.alias, c.societe, c.email, c.telephone_mobile, c.telephone_fixe, c.ville].filter(Boolean).join(" ")
        );
        return haystack.includes(q);
      })
      .sort((a, b) => contactSortKey(a).localeCompare(contactSortKey(b), "fr"));
  }, [contacts, search, filterType, filterActivity, filterMember]);

  return (
    <div className="max-w-4xl mx-auto p-5 sm:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-blue-950 tracking-tight">Contacts</h1>
          <p className="text-stone-500 text-sm mt-1">Perso, travail, artisans... {contacts.length} contact{contacts.length > 1 ? "s" : ""}, triés par ordre alphabétique.</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900"
        >
          <Plus size={15} /> Ajouter un contact
        </button>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom, une société, un téléphone, un email…"
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800"
          />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
          <option value="">Tous les types</option>
          {contactTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filterActivity} onChange={(e) => setFilterActivity(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
          <option value="">Toutes les activités</option>
          {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
          <option value="">Tous les membres</option>
          <option value="__general__">{GENERAL_LABEL}</option>
          {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 py-8 text-center">Aucun contact ne correspond à votre recherche.</p>
        )}
        {filtered.map((c) => {
          const isOpen = openId === c.id;
          const type = contactTypeById[c.contact_type_id];
          const activity = activityById[c.activity_id];
          const showType = type && !isGeneralName(type.name);
          const showActivity = activity && !isGeneralName(activity.name);
          const mainPhone = c.telephone_mobile || c.telephone_fixe;
          return (
            <div key={c.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(isOpen ? null : c.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(isOpen ? null : c.id); } }}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center text-sm font-medium shrink-0">
                  {contactDisplayName(c).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800 truncate">{contactTitle(c)}</p>
                  <p className="text-xs text-stone-400 truncate">
                    {mainPhone ? <PhoneCopy value={mainPhone} /> : "—"}
                  </p>
                </div>
                <button
                  onClick={(e) => toggleUrgence(c, e)}
                  title={c.numero_urgence ? "Retirer des numéros d'urgence" : "Marquer comme numéro d'urgence"}
                  className="shrink-0 text-rose-400 hover:text-rose-500"
                >
                  <AlertTriangle size={17} fill={c.numero_urgence ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => toggleEpingle(c, e)}
                  title={c.epingle ? "Désépingler" : "Épingler"}
                  className="shrink-0 text-blue-800 hover:text-blue-900"
                >
                  <Pin size={17} fill={c.epingle ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => toggleFavori(c, e)}
                  title={c.favori ? "Retirer des favoris" : "Marquer en favori"}
                  className="shrink-0 text-amber-400 hover:text-amber-500"
                >
                  <Star size={17} fill={c.favori ? "currentColor" : "none"} />
                </button>
                {(showType || showActivity) && (
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {showType && <TypeBadge type={type} />}
                    {showActivity && <TypeBadge type={activity} />}
                  </div>
                )}
              </div>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-stone-50 border-t border-stone-100 space-y-2">
                  {(showType || showActivity) && (
                    <div className="flex sm:hidden gap-1.5 flex-wrap">
                      {showType && <TypeBadge type={type} />}
                      {showActivity && <TypeBadge type={activity} />}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-stone-600">
                    {c.telephone_mobile && <p className="flex items-center gap-1.5"><Phone size={13} className="text-stone-400" /> <PhoneCopy value={c.telephone_mobile} /> <span className="text-stone-400">(mobile)</span></p>}
                    {c.telephone_fixe && <p className="flex items-center gap-1.5"><Phone size={13} className="text-stone-400" /> <PhoneCopy value={c.telephone_fixe} /> <span className="text-stone-400">(fixe)</span></p>}
                    {c.email && <p className="flex items-center gap-1.5"><Mail size={13} className="text-stone-400" /> {c.email}</p>}
                    {(c.adresse || c.ville) && <p className="flex items-center gap-1.5"><MapPin size={13} className="text-stone-400" /> {[c.adresse, c.code_postal, c.ville].filter(Boolean).join(" ")}</p>}
                    {c.date_naissance && <p className="flex items-center gap-1.5"><Cake size={13} className="text-stone-400" /> Né(e) le {formatDateFR(c.date_naissance)}</p>}
                    {c.societe && (c.nom || c.prenom) && <p className="flex items-center gap-1.5"><Building2 size={13} className="text-stone-400" /> Contact : {[c.prenom, c.nom].filter(Boolean).join(" ")}</p>}
                  </div>
                  {c.notes && <p className="text-xs text-stone-500 italic pt-1">{c.notes}</p>}
                  <div className="pt-2">
                    <button onClick={() => setEditing(c)} className="text-xs px-2.5 py-1.5 rounded-md border border-stone-300 hover:bg-white">Modifier</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing !== null && (
        <ContactEditor
          contact={editing}
          contactTypes={contactTypes}
          activities={activities}
          familyMembers={familyMembers}
          onCancel={() => setEditing(null)}
          onSave={async (fields) => {
            const ok = await onSave(fields, editing.id);
            if (ok) setEditing(null);
          }}
          onDelete={editing.id ? async () => { await onDelete(editing.id); setEditing(null); setOpenId(null); } : null}
        />
      )}
    </div>
  );
}

function ContactEditor({ contact, contactTypes, activities, familyMembers, onSave, onCancel, onDelete }) {
  const [contactTypeId, setContactTypeId] = useState(contact.contact_type_id || contactTypes[0]?.id || "");
  // Nouveau contact : activité "Général" par défaut (si elle existe) ; contact existant : sa valeur.
  const [activityId, setActivityId] = useState(
    contact.id ? contact.activity_id || "" : activities.find((a) => isGeneralName(a.name))?.id || ""
  );
  const [alias, setAlias] = useState(contact.alias || "");
  const [familyMemberId, setFamilyMemberId] = useState(contact.family_member_id || "");
  const [nom, setNom] = useState(contact.nom || "");
  const [prenom, setPrenom] = useState(contact.prenom || "");
  const [societe, setSociete] = useState(contact.societe || "");
  const [telephoneMobile, setTelephoneMobile] = useState(contact.telephone_mobile || "");
  const [telephoneFixe, setTelephoneFixe] = useState(contact.telephone_fixe || "");
  const [email, setEmail] = useState(contact.email || "");
  const [adresse, setAdresse] = useState(contact.adresse || "");
  const [codePostal, setCodePostal] = useState(contact.code_postal || "");
  const [ville, setVille] = useState(contact.ville || "");
  const [dateNaissance, setDateNaissance] = useState(contact.date_naissance || "");
  const [notes, setNotes] = useState(contact.notes || "");
  const [favori, setFavori] = useState(!!contact.favori);
  const [numeroUrgence, setNumeroUrgence] = useState(!!contact.numero_urgence);
  const [epingle, setEpingle] = useState(!!contact.epingle);
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-800">{contact.id ? "Modifier le contact" : "Nouveau contact"}</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNumeroUrgence((v) => !v)}
              title={numeroUrgence ? "Retirer des numéros d'urgence" : "Marquer comme numéro d'urgence"}
              className="text-rose-400 hover:text-rose-500"
            >
              <AlertTriangle size={19} fill={numeroUrgence ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => setEpingle((v) => !v)}
              title={epingle ? "Désépingler" : "Épingler"}
              className="text-blue-800 hover:text-blue-900"
            >
              <Pin size={19} fill={epingle ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => setFavori((f) => !f)}
              title={favori ? "Retirer des favoris" : "Marquer en favori"}
              className="text-amber-400 hover:text-amber-500"
            >
              <Star size={19} fill={favori ? "currentColor" : "none"} />
            </button>
            <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Type de contact</label>
            <select value={contactTypeId} onChange={(e) => setContactTypeId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              {contactTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Activité</label>
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              <option value="">—</option>
              {activities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Concerne</label>
            <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              <option value="">{GENERAL_LABEL}</option>
              {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Alias</label>
            <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Surnom, nom d'usage…" className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Nom</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Prénom</label>
            <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Société / Raison sociale <span className="text-stone-400">(artisan, entreprise…)</span></label>
            <input value={societe} onChange={(e) => setSociete(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Téléphone mobile</label>
            <input value={telephoneMobile} onChange={(e) => setTelephoneMobile(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Téléphone fixe</label>
            <input value={telephoneFixe} onChange={(e) => setTelephoneFixe(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Adresse</label>
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Code postal</label>
            <input value={codePostal} onChange={(e) => setCodePostal(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Ville</label>
            <input value={ville} onChange={(e) => setVille(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Date de naissance</label>
            <input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1.5">
              <Trash2 size={14} /> Supprimer
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100">Annuler</button>
            <button
              onClick={() => {
                if (!nom.trim() && !societe.trim()) { setError("Entrez au moins un nom ou une société."); return; }
                if (!contactTypeId) { setError("Choisissez un type de contact."); return; }
                onSave({
                  contactTypeId, activityId, familyMemberId, alias: alias.trim(), nom: nom.trim(), prenom: prenom.trim(), societe: societe.trim(),
                  telephoneMobile: telephoneMobile.trim(), telephoneFixe: telephoneFixe.trim(), email: email.trim(),
                  adresse: adresse.trim(), codePostal: codePostal.trim(), ville: ville.trim(), dateNaissance, notes: notes.trim(), favori,
                  numeroUrgence, epingle,
                });
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Documents ---------------------------- */

function DocumentsTab({ documents, documentTypes, familyMembers, documentTypeById, familyMemberById, onSave, onDelete, onDownload }) {
  const [filterType, setFilterType] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [editing, setEditing] = useState(null);

  const filtered = useMemo(() => {
    return documents
      .filter((d) => {
        if (filterType && d.document_type_id !== filterType) return false;
        if (filterMember === "__general__" && d.family_member_id) return false;
        if (filterMember && filterMember !== "__general__" && d.family_member_id !== filterMember) return false;
        return true;
      })
      .sort((a, b) => normalizeStr(a.libelle).localeCompare(normalizeStr(b.libelle), "fr"));
  }, [documents, filterType, filterMember]);

  return (
    <div className="max-w-4xl mx-auto p-5 sm:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-blue-950 tracking-tight">Documents</h1>
          <p className="text-stone-500 text-sm mt-1">Pièces d'identité, permis, justificatifs... {documents.length} document{documents.length > 1 ? "s" : ""}.</p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900"
        >
          <Plus size={15} /> Ajouter un document
        </button>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-3 flex flex-wrap gap-2 items-center">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
          <option value="">Tous les types</option>
          {documentTypes.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
        </select>
        <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
          <option value="">Tous les membres</option>
          <option value="__general__">{GENERAL_LABEL}</option>
          {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {filtered.length === 0 && (
          <p className="text-sm text-stone-400 py-8 text-center">Aucun document ne correspond à ce filtre.</p>
        )}
        {filtered.map((d) => {
          const remaining = daysUntil(d.date_fin_validite);
          const expiring = remaining !== null && remaining <= 30;
          const expired = remaining !== null && remaining < 0;
          const docType = documentTypeById[d.document_type_id];
          return (
            <div key={d.id} className="px-4 py-3 flex items-center gap-3 hover:bg-stone-50">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${expired ? "bg-rose-50 text-rose-600" : expiring ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-900"}`}>
                {docType?.emoji ? <span className="text-base leading-none">{docType.emoji}</span> : fileExtIcon()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800 truncate">{d.libelle}</p>
                <p className="text-xs text-stone-400 truncate">
                  {typeLabel(docType)}
                  {d.date_fin_validite && (
                    <>
                      {" · "}
                      <span className={expired ? "text-rose-600" : expiring ? "text-amber-600" : ""}>
                        {expired ? "Expiré le" : "Valide jusqu'au"} {formatDateFR(d.date_fin_validite)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="hidden sm:block shrink-0">
                <MemberBadge member={familyMemberById[d.family_member_id]} />
              </div>
              {(expired || expiring) && (
                <AlertTriangle size={15} className={expired ? "text-rose-500 shrink-0" : "text-amber-500 shrink-0"} />
              )}
              {d.file_path && (
                <button onClick={() => onDownload(d)} title="Télécharger" className="p-1.5 text-stone-400 hover:text-blue-800 shrink-0">
                  <Download size={16} />
                </button>
              )}
              <button onClick={() => setEditing(d)} className="text-xs px-2.5 py-1.5 rounded-md border border-stone-300 hover:bg-white shrink-0">
                Modifier
              </button>
            </div>
          );
        })}
      </div>

      {editing !== null && (
        <DocumentEditor
          doc={editing}
          documentTypes={documentTypes}
          familyMembers={familyMembers}
          onCancel={() => setEditing(null)}
          onSave={async (fields) => {
            const ok = await onSave(fields, editing.id, editing.id ? editing : null);
            if (ok) setEditing(null);
          }}
          onDelete={editing.id ? async () => { await onDelete(editing); setEditing(null); } : null}
        />
      )}
    </div>
  );
}

function DocumentEditor({ doc, documentTypes, familyMembers, onSave, onCancel, onDelete }) {
  const [documentTypeId, setDocumentTypeId] = useState(doc.document_type_id || documentTypes[0]?.id || "");
  const [familyMemberId, setFamilyMemberId] = useState(doc.family_member_id || "");
  const [libelle, setLibelle] = useState(doc.libelle || "");
  const [dateDocument, setDateDocument] = useState(doc.date_document || "");
  const [dateFinValidite, setDateFinValidite] = useState(doc.date_fin_validite || "");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-800">{doc.id ? "Modifier le document" : "Nouveau document"}</h3>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Type de document</label>
            <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              {documentTypes.map((t) => <option key={t.id} value={t.id}>{typeLabel(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Concerne</label>
            <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              <option value="">{GENERAL_LABEL}</option>
              {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Libellé</label>
            <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex : Carte d'identité Julia" className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Date du document</label>
            <input type="date" value={dateDocument} onChange={(e) => setDateDocument(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Date de fin de validité</label>
            <input type="date" value={dateFinValidite} onChange={(e) => setDateFinValidite(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Fichier</label>
            {doc.file_name && !file && (
              <p className="text-xs text-stone-500 mb-1.5 flex items-center gap-1.5"><FileText size={13} /> Actuel : {doc.file_name}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-stone-600 file:mr-3 file:px-2.5 file:py-1.5 file:rounded-md file:border file:border-stone-300 file:bg-white file:text-sm file:cursor-pointer"
            />
            <p className="text-xs text-stone-400 mt-1">{doc.file_name ? "Choisissez un fichier pour le remplacer." : "PDF, photo, scan…"}</p>
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1.5">
              <Trash2 size={14} /> Supprimer
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100">Annuler</button>
            <button
              disabled={uploading}
              onClick={async () => {
                if (!libelle.trim()) { setError("Entrez un libellé."); return; }
                if (!documentTypeId) { setError("Choisissez un type de document."); return; }
                setUploading(true);
                await onSave({ documentTypeId, familyMemberId, libelle: libelle.trim(), dateDocument, dateFinValidite, file });
                setUploading(false);
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-60"
            >
              {uploading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Paramétrage ---------------------------- */

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full ${SWATCH_BG[c]} ${value === c ? "ring-2 ring-offset-1 ring-stone-800" : ""}`}
          aria-label={c}
        >
          {value === c && <Check size={12} className="text-white mx-auto" />}
        </button>
      ))}
    </div>
  );
}

// Petit sélecteur d'emoji en popover : un bouton qui affiche l'emoji choisi
// (ou un tiret), et ouvre une grille au clic. "options" est la liste des
// emojis proposés (différente pour les membres de la famille et les types de
// document, voir FAMILY_EMOJI_OPTIONS / DOCUMENT_EMOJI_OPTIONS).
function EmojiPicker({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Choisir un emoji"
        className="w-8 h-8 rounded-md border border-stone-300 flex items-center justify-center text-base bg-white hover:bg-stone-50"
      >
        {value || <span className="text-stone-300 text-xs">—</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 left-0 bg-white border border-stone-300 rounded-md shadow-lg p-2 w-64 max-h-56 overflow-y-auto grid grid-cols-8 gap-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              title="Aucun emoji"
              className="w-7 h-7 rounded hover:bg-stone-100 flex items-center justify-center text-stone-400 text-xs"
            >
              ✕
            </button>
            {options.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false); }}
                className={`w-7 h-7 rounded hover:bg-stone-100 flex items-center justify-center text-base ${value === e ? "bg-stone-100 ring-1 ring-stone-400" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RefListEditor({ title, description, items, placeholder, withColor, withEmoji, emojiOptions, onAdd, onUpdate, onUpdateColor, onUpdateEmoji, onRemove, blockedMessage }) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [newEmoji, setNewEmoji] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="bg-white rounded-lg border border-stone-300 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-stone-700">{title}</h2>
        {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 border border-stone-200 rounded-md p-2.5">
            {withEmoji && <EmojiPicker value={it.emoji || ""} onChange={(e) => onUpdateEmoji(it.id, e)} options={emojiOptions} />}
            <input
              value={it.name}
              onChange={(e) => onUpdate(it.id, e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            {withColor && <ColorPicker value={it.color || "stone"} onChange={(color) => onUpdateColor(it.id, color)} />}
            <button
              onClick={async () => {
                const ok = await onRemove(it.id);
                if (!ok) setError(blockedMessage(it.name));
                else setError("");
              }}
              className="text-stone-400 hover:text-rose-600 shrink-0"
              aria-label={`Supprimer ${it.name}`}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-stone-400 py-2">Aucun élément pour l'instant.</p>}
      </ul>
      <div className="border-t border-stone-100 pt-3 flex flex-wrap items-end gap-3">
        {withEmoji && (
          <div>
            <label className="text-xs text-stone-500 block mb-1">Emoji</label>
            <EmojiPicker value={newEmoji} onChange={setNewEmoji} options={emojiOptions} />
          </div>
        )}
        <div>
          <label className="text-xs text-stone-500 block mb-1">Nouveau</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={placeholder} className="px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400" />
        </div>
        {withColor && (
          <div>
            <label className="text-xs text-stone-500 block mb-1">Couleur</label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        )}
        <button
          onClick={() => { if (newName.trim()) { onAdd(newName.trim(), withColor ? newColor : undefined, withEmoji ? newEmoji : undefined); setNewName(""); setNewEmoji(""); } }}
          className="px-3 py-1.5 text-sm rounded-md border border-stone-400 text-stone-700 hover:bg-stone-100"
        >
          <Plus size={14} className="inline -mt-0.5 mr-1" />Ajouter
        </button>
      </div>
    </div>
  );
}

function ImportContactsPanel({ contactTypes, familyMembers, onImportContacts }) {
  const [rows, setRows] = useState(null); // null = pas de fichier chargé
  const [bulkType, setBulkType] = useState(contactTypes[0]?.id || "");
  const [bulkMember, setBulkMember] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState("");
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult("");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseVCardFile(String(reader.result));
        setRows(
          parsed.map((r, i) => ({
            ...r,
            id: i,
            selected: true,
            contactTypeId: bulkType,
            familyMemberId: bulkMember,
          }))
        );
      } catch (err) {
        setResult("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un export .vcf.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function applyBulk() {
    setRows((rs) => rs.map((r) => ({ ...r, contactTypeId: bulkType, familyMemberId: bulkMember })));
  }

  async function handleImport() {
    const selected = rows.filter((r) => r.selected && r.contactTypeId);
    if (selected.length === 0) return;
    setImporting(true);
    const { successCount, failures } = await onImportContacts(selected);
    setImporting(false);
    const failedIds = new Set(failures.map((f) => f.id));
    if (failures.length === 0) {
      setResult(`${successCount} contact(s) importé(s).`);
      setRows(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setResult(
        `${successCount} contact(s) importé(s). ${failures.length} en échec (voir ci-dessous) — corrigez et relancez l'import pour ceux-là.`
      );
      setRows((rs) =>
        rs
          .filter((r) => failedIds.has(r.id))
          .map((r) => ({ ...r, selected: true, importError: failures.find((f) => f.id === r.id)?.message || "" }))
      );
    }
  }

  return (
    <div className="bg-white rounded-lg border border-stone-300 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-stone-700 flex items-center gap-1.5"><UploadCloud size={15} /> Importer des contacts (.vcf)</h2>
        <p className="text-xs text-stone-400 mt-0.5">
          Exportez vos contacts depuis votre téléphone (Android : Contacts &gt; Paramètres &gt; Exporter ; iPhone : via iCloud.com ou un partage vCard),
          puis chargez le fichier .vcf ici. Vous choisirez le type et le membre concerné avant l'import — rien n'est enregistré tant que vous n'avez pas validé.
        </p>
      </div>

      {rows === null && (
        <input
          ref={fileInputRef}
          type="file"
          accept=".vcf,text/vcard"
          onChange={handleFile}
          className="w-full text-sm text-stone-600 file:mr-3 file:px-2.5 file:py-1.5 file:rounded-md file:border file:border-stone-300 file:bg-white file:text-sm file:cursor-pointer"
        />
      )}

      {result && <p className={`text-xs ${result.includes("échec") ? "text-amber-700" : "text-emerald-700"}`}>{result}</p>}

      {rows !== null && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3 bg-stone-50 border border-stone-200 rounded-md p-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Type pour tous</label>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
                {contactTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Membre pour tous</label>
              <select value={bulkMember} onChange={(e) => setBulkMember(e.target.value)} className="px-2.5 py-1.5 rounded-md border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-800">
                <option value="">{GENERAL_LABEL}</option>
                {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
              </select>
            </div>
            <button onClick={applyBulk} className="px-3 py-1.5 text-sm rounded-md border border-stone-400 text-stone-700 hover:bg-white">Appliquer à tous</button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRows((rs) => rs.map((r) => ({ ...r, selected: true })))}
                title="Tout sélectionner"
                className="p-1.5 rounded-md border border-stone-300 text-stone-600 hover:bg-white"
              >
                <CheckSquare size={16} />
              </button>
              <button
                onClick={() => setRows((rs) => rs.map((r) => ({ ...r, selected: false })))}
                title="Tout désélectionner"
                className="p-1.5 rounded-md border border-stone-300 text-stone-600 hover:bg-white"
              >
                <Square size={16} />
              </button>
            </div>
            <button onClick={() => { setRows(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="ml-auto text-xs text-stone-500 hover:text-stone-700 underline">Charger un autre fichier</button>
          </div>

          <p className="text-xs text-stone-500">{rows.length} contact(s) trouvé(s) dans le fichier. Décochez ceux à ne pas importer, ajustez le type/membre au cas par cas si besoin.</p>

          <div className="max-h-96 overflow-y-auto divide-y divide-stone-100 border border-stone-200 rounded-md">
            {rows.map((r, idx) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, selected: e.target.checked } : x)))}
                />
                <span className="min-w-[160px] flex-1 truncate">
                  {r.fullName}{r.org ? ` — ${r.org}` : ""}
                  {r.importError && <span className="block text-xs text-rose-600">{r.importError}</span>}
                </span>
                <select
                  value={r.contactTypeId}
                  onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, contactTypeId: e.target.value } : x)))}
                  className="px-2 py-1 rounded-md border border-stone-300 bg-white text-xs"
                >
                  {contactTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select
                  value={r.familyMemberId}
                  onChange={(e) => setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, familyMemberId: e.target.value } : x)))}
                  className="px-2 py-1 rounded-md border border-stone-300 bg-white text-xs"
                >
                  <option value="">{GENERAL_LABEL}</option>
                  {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button
            disabled={importing || rows.every((r) => !r.selected)}
            onClick={handleImport}
            className="px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-60"
          >
            {importing ? "Import en cours…" : `Importer ${rows.filter((r) => r.selected).length} contact(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

function CoffreSettingsTab({ familyMembers, contactTypes, activities, documentTypes, contacts, documents, onAddRef, onAddColoredRef, onUpdateRef, onRemoveRef, onUpdateRefColor, onUpdateRefEmoji, onImportContacts }) {
  return (
    <div className="max-w-3xl mx-auto p-5 sm:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-stone-700 tracking-tight">Paramétrage</h1>
        <p className="text-stone-500 text-sm mt-1">Membres de la famille, types de contact, activités, types de document, et import.</p>
      </div>

      <RefListEditor
        title="Membres de la famille"
        description="Utilisés pour rattacher un contact ou un document à une personne (ou à « Général »). L'emoji, s'il est choisi, s'affiche partout devant le nom."
        items={familyMembers}
        placeholder="Prénom"
        withEmoji
        emojiOptions={FAMILY_EMOJI_OPTIONS}
        onAdd={(name, _color, emoji) => onAddRef("family_members", name, emoji)}
        onUpdate={(id, name) => onUpdateRef("family_members", id, name)}
        onUpdateEmoji={(id, emoji) => onUpdateRefEmoji("family_members", id, emoji)}
        onRemove={(id) => onRemoveRef("family_members", id)}
        blockedMessage={(name) => `« ${name} » est encore utilisé par des contacts ou documents : réaffectez-les avant de le supprimer.`}
      />

      <RefListEditor
        title="Types de contact"
        description="Ex : Personnel, Travail, Société, Artisan… (« Général » n'est pas affiché sur la ligne du contact)"
        items={contactTypes}
        placeholder="Nom du type"
        withColor
        onAdd={(name, color) => onAddColoredRef("contact_types", name, color)}
        onUpdate={(id, name) => onUpdateRef("contact_types", id, name)}
        onUpdateColor={(id, color) => onUpdateRefColor("contact_types", id, color)}
        onRemove={(id) => onRemoveRef("contact_types", id)}
        blockedMessage={(name) => `« ${name} » est utilisé par des contacts : réaffectez-les avant de le supprimer.`}
      />

      <RefListEditor
        title="Activités"
        description="Ex : Général, Plombier, Médecin, Électricien… Sert à filtrer les contacts (« Général » n'est pas affiché sur la ligne du contact)."
        items={activities}
        placeholder="Nom de l'activité"
        withColor
        onAdd={(name, color) => onAddColoredRef("activities", name, color)}
        onUpdate={(id, name) => onUpdateRef("activities", id, name)}
        onUpdateColor={(id, color) => onUpdateRefColor("activities", id, color)}
        onRemove={(id) => onRemoveRef("activities", id)}
        blockedMessage={(name) => `« ${name} » est utilisé par des contacts : réaffectez-les avant de le supprimer.`}
      />

      <RefListEditor
        title="Types de document"
        description="Ex : Carte d'identité, Permis de conduire, Justificatif de domicile, Passeport, Carnet de santé… L'emoji remplace l'icône générique dans la liste des documents."
        items={documentTypes}
        placeholder="Nom du type"
        withEmoji
        emojiOptions={DOCUMENT_EMOJI_OPTIONS}
        onAdd={(name, _color, emoji) => onAddRef("document_types", name, emoji)}
        onUpdate={(id, name) => onUpdateRef("document_types", id, name)}
        onUpdateEmoji={(id, emoji) => onUpdateRefEmoji("document_types", id, emoji)}
        onRemove={(id) => onRemoveRef("document_types", id)}
        blockedMessage={(name) => `« ${name} » est utilisé par des documents : réaffectez-les avant de le supprimer.`}
      />

      <ImportContactsPanel contactTypes={contactTypes} familyMembers={familyMembers} onImportContacts={onImportContacts} />
    </div>
  );
}

/* ---------------------------- Événements ---------------------------- */

function EventsTab({ contacts, documents, familyMemberById, documentTypeById, onGoToContacts }) {
  const { start, end } = useMemo(() => eventsWindow(), []);

  const favoriteContacts = useMemo(() => contacts.filter((c) => c.favori), [contacts]);

  const birthdays = useMemo(() => {
    return favoriteContacts
      .filter((c) => c.date_naissance)
      .map((c) => ({ contact: c, occ: nextBirthdayOccurrence(c.date_naissance, start) }))
      .filter((x) => x.occ && x.occ.date <= end)
      .sort((a, b) => a.occ.date - b.occ.date);
  }, [favoriteContacts, start, end]);

  const expiringDocs = useMemo(() => {
    return documents
      .filter((d) => d.date_fin_validite)
      .map((d) => ({ doc: d, date: new Date(d.date_fin_validite + "T00:00:00") }))
      .filter((x) => x.date >= start && x.date <= end)
      .sort((a, b) => a.date - b.date);
  }, [documents, start, end]);

  const periodLabel = `${new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(start)} → ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(end)}`;

  return (
    <div className="max-w-4xl mx-auto p-5 sm:p-8 space-y-6">
      <div>
        <h1 className="font-serif text-2xl text-blue-950 tracking-tight">Événements</h1>
        <p className="text-stone-500 text-sm mt-1">Sur les 3 prochains mois ({periodLabel}) : anniversaires des favoris et documents à renouveler.</p>
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h2 className="text-sm font-medium text-stone-700 flex items-center gap-1.5"><PartyPopper size={16} className="text-amber-500" /> Anniversaires</h2>
        {favoriteContacts.length === 0 && (
          <p className="text-sm text-stone-400">
            Aucun contact en favori pour l'instant.{" "}
            <button onClick={onGoToContacts} className="text-blue-800 underline">Marquez-en depuis l'onglet Contacts</button> (icône étoile) pour les voir apparaître ici.
          </p>
        )}
        {favoriteContacts.length > 0 && birthdays.length === 0 && (
          <p className="text-sm text-stone-400">Aucun anniversaire de favori dans les 3 prochains mois.</p>
        )}
        {birthdays.map(({ contact: c, occ }) => {
          const isToday = occ.date.getTime() === start.getTime();
          return (
            <div key={c.id} className="flex items-center gap-3 px-1 py-1.5 border-b border-stone-50 last:border-0">
              <Cake size={16} className={isToday ? "text-rose-500 shrink-0" : "text-stone-400 shrink-0"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-stone-800 truncate">{contactDisplayName(c)} <span className="text-stone-400">— {occ.turningAge} ans</span></p>
              </div>
              <span className={`text-xs shrink-0 ${isToday ? "text-rose-600 font-medium" : "text-stone-500"}`}>{isToday ? "Aujourd'hui" : formatDayMonthFR(occ.date)}</span>
              <span className="shrink-0"><MemberBadge member={familyMemberById[c.family_member_id]} /></span>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
        <h2 className="text-sm font-medium text-stone-700 flex items-center gap-1.5"><AlertTriangle size={16} className="text-amber-500" /> Documents à renouveler</h2>
        {expiringDocs.length === 0 && (
          <p className="text-sm text-stone-400">Aucun document n'expire dans les 3 prochains mois.</p>
        )}
        {expiringDocs.map(({ doc: d, date }) => {
          const remaining = daysUntil(d.date_fin_validite);
          const expired = remaining !== null && remaining < 0;
          return (
            <div key={d.id} className="flex items-center gap-3 px-1 py-1.5 border-b border-stone-50 last:border-0">
              <FileText size={16} className="text-stone-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-stone-800 truncate">{d.libelle} <span className="text-stone-400">— {typeLabel(documentTypeById[d.document_type_id])}</span></p>
              </div>
              <span className={`text-xs shrink-0 ${expired ? "text-rose-600" : "text-amber-600"}`}>
                {expired ? "Expiré le" : "Jusqu'au"} {formatDateFR(d.date_fin_validite)}
              </span>
              <span className="shrink-0"><MemberBadge member={familyMemberById[d.family_member_id]} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------- Santé (carnet de vaccination) ---------------------------- */

function HealthTab({ familyMembers, vaccinations, documents, documentTypes, onSaveVaccination, onDeleteVaccination, onImportVaccinations, onExtractHealthRecord, onSaveDocument }) {
  const [selectedMemberId, setSelectedMemberId] = useState(familyMembers[0]?.id || "");
  const [editing, setEditing] = useState(null); // null fermé, {} nouveau, {...} édition
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!selectedMemberId && familyMembers[0]) setSelectedMemberId(familyMembers[0].id);
  }, [familyMembers, selectedMemberId]);

  const memberVaccinations = useMemo(() => {
    return vaccinations
      .filter((v) => v.family_member_id === selectedMemberId)
      .sort((a, b) => {
        const da = a.date_administered ? new Date(a.date_administered) : null;
        const db = b.date_administered ? new Date(b.date_administered) : null;
        if (da && db) return db - da;
        if (da) return -1;
        if (db) return 1;
        return normalizeStr(a.vaccine_name).localeCompare(normalizeStr(b.vaccine_name), "fr");
      });
  }, [vaccinations, selectedMemberId]);

  if (familyMembers.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-5 sm:p-8">
        <h1 className="font-serif text-2xl text-blue-950 tracking-tight">Santé</h1>
        <p className="text-stone-500 text-sm mt-2">
          Ajoutez d'abord un membre de la famille dans Paramétrage pour pouvoir suivre son carnet de vaccination.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-5 sm:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-blue-950 tracking-tight">Santé</h1>
          <p className="text-stone-500 text-sm mt-1">Carnet de vaccination, par membre de la famille.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImporting(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-stone-300 bg-white hover:bg-stone-100"
          >
            <UploadCloud size={15} /> Importer un scan
          </button>
          <button
            onClick={() => setEditing({})}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900"
          >
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {familyMembers.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedMemberId(m.id)}
            className={`px-3 py-1.5 rounded-full text-sm border ${
              selectedMemberId === m.id ? "bg-blue-950 text-white border-blue-950" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-100"
            }`}
          >
            {memberLabel(m)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {memberVaccinations.length === 0 && (
          <p className="text-sm text-stone-400 py-8 text-center">Aucune vaccination enregistrée pour ce membre.</p>
        )}
        {memberVaccinations.map((v) => (
          <div key={v.id} className="px-4 py-3 flex items-center gap-3 hover:bg-stone-50">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
              <Syringe size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800 truncate">
                {v.vaccine_name}{v.dose_label ? ` — ${v.dose_label}` : ""}
              </p>
              <p className="text-xs text-stone-400 truncate">
                {v.date_administered ? formatDateFR(v.date_administered) : "Date inconnue"}
                {v.lot_number ? ` · Lot ${v.lot_number}` : ""}
              </p>
            </div>
            <button onClick={() => setEditing(v)} className="text-xs px-2.5 py-1.5 rounded-md border border-stone-300 hover:bg-white shrink-0">
              Modifier
            </button>
          </div>
        ))}
      </div>

      {editing !== null && (
        <VaccinationEditor
          vaccination={editing}
          familyMembers={familyMembers}
          defaultMemberId={selectedMemberId}
          onCancel={() => setEditing(null)}
          onSave={async (fields) => {
            const ok = await onSaveVaccination(fields, editing.id);
            if (ok) setEditing(null);
          }}
          onDelete={editing.id ? async () => { await onDeleteVaccination(editing.id); setEditing(null); } : null}
        />
      )}

      {importing && (
        <HealthImportPanel
          familyMembers={familyMembers}
          documentTypes={documentTypes}
          defaultMemberId={selectedMemberId}
          onCancel={() => setImporting(false)}
          onExtract={onExtractHealthRecord}
          onSaveDocument={onSaveDocument}
          onImportVaccinations={onImportVaccinations}
          onDone={() => setImporting(false)}
        />
      )}
    </div>
  );
}

function VaccinationEditor({ vaccination, familyMembers, defaultMemberId, onSave, onCancel, onDelete }) {
  const [familyMemberId, setFamilyMemberId] = useState(vaccination.family_member_id || defaultMemberId || familyMembers[0]?.id || "");
  const [vaccineName, setVaccineName] = useState(vaccination.vaccine_name || "");
  const [dateAdministered, setDateAdministered] = useState(vaccination.date_administered || "");
  const [lotNumber, setLotNumber] = useState(vaccination.lot_number || "");
  const [doseLabel, setDoseLabel] = useState(vaccination.dose_label || "");
  const [notes, setNotes] = useState(vaccination.notes || "");
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-800">{vaccination.id ? "Modifier la vaccination" : "Nouvelle vaccination"}</h3>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Membre de la famille</label>
            <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
              {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Vaccin</label>
            <input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="Ex : DTPolio, ROR, hépatite B…" className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Date</label>
            <input type="date" value={dateAdministered} onChange={(e) => setDateAdministered(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Dose / rappel</label>
            <input value={doseLabel} onChange={(e) => setDoseLabel(e.target.value)} placeholder="Ex : 1ère dose, rappel…" className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">N° de lot</label>
            <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-stone-500 block mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800" />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          {onDelete ? (
            <button onClick={onDelete} className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 px-2 py-1.5">
              <Trash2 size={14} /> Supprimer
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100">Annuler</button>
            <button
              onClick={() => {
                if (!vaccineName.trim()) { setError("Entrez le nom du vaccin."); return; }
                if (!familyMemberId) { setError("Choisissez un membre de la famille."); return; }
                onSave({
                  familyMemberId, vaccineName: vaccineName.trim(), dateAdministered,
                  lotNumber: lotNumber.trim(), doseLabel: doseLabel.trim(), notes: notes.trim(),
                });
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptyExtractedRow() {
  return { id: Math.random().toString(36).slice(2), include: true, vaccineName: "", dateAdministered: "", lotNumber: "", doseLabel: "" };
}

// Import d'un scan de carnet de santé : lit le fichier, l'envoie à la fonction
// d'extraction (Gemini côté serveur), puis affiche les lignes trouvées pour
// relecture/correction avant tout enregistrement — rien n'est jamais inséré
// dans le carnet de vaccination sans validation manuelle.
function HealthImportPanel({ familyMembers, documentTypes, defaultMemberId, onCancel, onExtract, onSaveDocument, onImportVaccinations, onDone }) {
  const [familyMemberId, setFamilyMemberId] = useState(defaultMemberId || familyMembers[0]?.id || "");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | analyzing | review | saving
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [keepFile, setKeepFile] = useState(true);

  const healthDocType = documentTypes.find((t) => normalizeStr(t.name).includes(normalizeStr("santé")) || normalizeStr(t.name).includes(normalizeStr("carnet")));

  async function handleAnalyze() {
    if (!file) { setError("Choisissez d'abord une photo ou un PDF du carnet."); return; }
    if (!familyMemberId) { setError("Choisissez le membre de la famille concerné."); return; }
    setError("");
    setStatus("analyzing");
    try {
      const base64 = await fileToBase64(file);
      const entries = await onExtract(base64, file.type || "application/octet-stream");
      setRows(
        (entries && entries.length ? entries : [{}]).map((e) => ({
          id: Math.random().toString(36).slice(2),
          include: true,
          vaccineName: e.vaccineName || e.vaccine || "",
          dateAdministered: e.dateAdministered || e.date || "",
          lotNumber: e.lotNumber || e.lot || "",
          doseLabel: e.doseLabel || e.dose || "",
        }))
      );
      setStatus("review");
    } catch (e) {
      setError(e.message || "La lecture automatique du scan a échoué.");
      setStatus("idle");
    }
  }

  function updateRow(id, field, value) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function removeRow(id) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function handleConfirm() {
    const included = rows.filter((r) => r.include && r.vaccineName.trim());
    if (included.length === 0) { setError("Cochez au moins une ligne avec un nom de vaccin."); return; }
    setStatus("saving");
    setError("");
    if (keepFile && file && healthDocType) {
      await onSaveDocument(
        {
          documentTypeId: healthDocType.id,
          familyMemberId,
          libelle: `Carnet de santé — import du ${formatDateFR(new Date().toISOString().slice(0, 10))}`,
          dateDocument: "",
          dateFinValidite: "",
          file,
        },
        null,
        null
      );
    }
    await onImportVaccinations(
      familyMemberId,
      included.map((r) => ({
        vaccineName: r.vaccineName.trim(),
        dateAdministered: r.dateAdministered,
        lotNumber: r.lotNumber.trim(),
        doseLabel: r.doseLabel.trim(),
        notes: "",
      })),
      null
    );
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end sm:items-center justify-center z-20 p-0 sm:p-4">
      <div className="bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-stone-800">Importer un scan de carnet de santé</h3>
          <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        {status !== "review" && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Membre de la famille</label>
              <select value={familyMemberId} onChange={(e) => setFamilyMemberId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800">
                {familyMembers.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Photo ou PDF du carnet</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-stone-600 file:mr-3 file:px-2.5 file:py-1.5 file:rounded-md file:border file:border-stone-300 file:bg-white file:text-sm file:cursor-pointer"
              />
            </div>
            <p className="text-xs text-stone-500 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
              Écriture manuscrite : la lecture automatique peut se tromper. Vous pourrez corriger chaque ligne avant tout enregistrement — rien n'est ajouté au carnet sans votre validation.
            </p>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100">Annuler</button>
              <button
                onClick={handleAnalyze}
                disabled={status === "analyzing"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-60"
              >
                {status === "analyzing" && <Loader2 size={14} className="animate-spin" />}
                {status === "analyzing" ? "Analyse en cours…" : "Analyser"}
              </button>
            </div>
          </div>
        )}

        {status === "review" && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              {rows.length} ligne{rows.length > 1 ? "s" : ""} détectée{rows.length > 1 ? "s" : ""} pour <span className="font-medium">{memberLabel(familyMembers.find((m) => m.id === familyMemberId))}</span>. Relisez et corrigez avant d'enregistrer.
            </p>
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start gap-2 bg-stone-50 rounded-md p-2">
                  <button type="button" onClick={() => updateRow(r.id, "include", !r.include)} className="mt-1.5 shrink-0" title={r.include ? "Exclure cette ligne" : "Inclure cette ligne"}>
                    {r.include ? <CheckSquare size={16} className="text-blue-800" /> : <Square size={16} className="text-stone-400" />}
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 flex-1 min-w-0">
                    <input value={r.vaccineName} onChange={(e) => updateRow(r.id, "vaccineName", e.target.value)} placeholder="Vaccin" className="col-span-2 px-2 py-1 rounded border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-800" />
                    <input type="date" value={r.dateAdministered} onChange={(e) => updateRow(r.id, "dateAdministered", e.target.value)} className="px-2 py-1 rounded border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-800" />
                    <input value={r.doseLabel} onChange={(e) => updateRow(r.id, "doseLabel", e.target.value)} placeholder="Dose / rappel" className="px-2 py-1 rounded border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-800" />
                    <input value={r.lotNumber} onChange={(e) => updateRow(r.id, "lotNumber", e.target.value)} placeholder="N° de lot" className="col-span-2 px-2 py-1 rounded border border-stone-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-800" />
                  </div>
                  <button type="button" onClick={() => removeRow(r.id)} className="mt-1 text-stone-400 hover:text-rose-600 shrink-0"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setRows((rs) => [...rs, emptyExtractedRow()])} className="text-xs text-blue-800 hover:underline flex items-center gap-1">
                <Plus size={12} /> Ajouter une ligne
              </button>
            </div>

            {healthDocType ? (
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input type="checkbox" checked={keepFile} onChange={(e) => setKeepFile(e.target.checked)} />
                Garder aussi le scan dans Documents ({typeLabel(healthDocType)})
              </label>
            ) : (
              <p className="text-xs text-stone-400">Aucun type de document « Carnet de santé » trouvé : le scan ne sera pas gardé dans Documents (vous pouvez l'ajouter vous-même depuis l'onglet Documents).</p>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setStatus("idle")} className="px-3 py-1.5 text-sm rounded-md border border-stone-300 hover:bg-stone-100">Retour</button>
              <button
                onClick={handleConfirm}
                disabled={status === "saving"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-950 text-white hover:bg-blue-900 disabled:opacity-60"
              >
                {status === "saving" && <Loader2 size={14} className="animate-spin" />}
                {status === "saving" ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
