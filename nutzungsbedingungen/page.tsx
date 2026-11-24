import Link from 'next/link';

export const metadata = {
  title: 'Datenschutzerklärung – Familien-Touchwall',
  description: 'Informationen zur Verarbeitung personenbezogener Daten sowie zur Google- und Microsoft-OAuth-Anbindung.'
};

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#12151a] text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto rounded-3xl border border-slate-700/80 bg-[#1c2128] p-6 sm:p-10 shadow-2xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-5">
          <div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold border border-emerald-400/30">
              🔒 Datenschutz & DSGVO
            </span>
            <h1 className="text-2xl sm:text-3xl font-black mt-2">Datenschutzerklärung</h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Familien-Touchwall & Touchwall Pocket • Stand: November 2026
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-extrabold"
            >
              ← Zur Touchwall
            </Link>
            <Link
              href="/nutzungsbedingungen"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-extrabold"
            >
              Nutzungsbedingungen
            </Link>
          </div>
        </div>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-black text-white">1. Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung im Rahmen dieser Webanwendung
            („Familien-Touchwall“ und „Touchwall Pocket“) ist:
          </p>
          <p className="p-3.5 rounded-2xl bg-[#13171c] border border-slate-700/70 text-xs sm:text-sm font-semibold text-slate-200">
            Hans Richter<br />
            79618 Rheinfelden (Baden), Deutschland<br />
            E-Mail: hgr3dsm@googlemail.com
          </p>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-black text-white">2. Zweck der Anwendung & verarbeitete Daten</h2>
          <p>
            Die Anwendung dient der privaten Familienorganisation (Kalender, Aufgaben, Einkaufsliste,
            Speisekammer-/Vorratsverwaltung, Essensplan, Stundenpläne und Notizen). Dabei werden – je nach
            Nutzung – folgende Daten verarbeitet:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Kontodaten:</strong> Benutzername, gehashtes Passwort (SHA-256), optional hinterlegte
              E-Mail-Adresse für Passwort-Resets sowie ein gehashter Notfall-Recovery-Code.
            </li>
            <li>
              <strong>Organisationsdaten:</strong> Selbst angelegte Termine, Familienmitglieder-Namen,
              Aufgaben, Einkaufslisten, Vorrats- und Mülleimer-Einträge, Essenspläne und Stundenpläne.
            </li>
            <li>
              <strong>Technische Sitzungsdaten:</strong> Lokale Browser-Speicherung (<code>localStorage</code>)
              und technisch notwendige Session-Cookies zur Aufrechterhaltung der Anmeldung sowie zum
              Offline-Caching.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-black text-white">
            3. Google OAuth & Google Calendar API (Google User Data Policy)
          </h2>
          <p>
            Nutzer können ihr Konto optional per Google OAuth anmelden oder ihren Google Kalender mit
            der Touchwall verknüpfen. Dabei werden ausschließlich die freigegebenen Berechtigungen
            (<code>openid</code>, <code>email</code>, <code>profile</code> und{' '}
            <code>https://www.googleapis.com/auth/calendar</code>) verwendet:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Anmeldung & Identifikation:</strong> E-Mail-Adresse und Anzeigename zur Zuordnung
              des Familienkontos.
            </li>
            <li>
              <strong>Zwei-Wege-Kalendersynchronisation:</strong> Auslesen, Anlegen, Bearbeiten,
              Verschieben und Löschen von Terminen im gewählten Google Kalender direkt über die Touchwall.
            </li>
            <li>
              <strong>Token-Speicherung:</strong> OAuth Access- und Refresh-Tokens werden serverseitig
              geschützt in unserer Datenbank (Supabase) gespeichert, damit die Synchronisation dauerhaft
              funktioniert.
            </li>
          </ul>
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-400/30 text-xs sm:text-sm text-sky-100">
            <strong>Limited Use Hinweis (Google API Services User Data Policy):</strong> Die Nutzung und
            Weitergabe von Informationen, die über Google APIs empfangen werden, entspricht vollständig
            der{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="underline text-sky-300 font-bold"
            >
              Google API Services User Data Policy
            </a>
            , einschließlich der Anforderungen zur eingeschränkten Nutzung (<em>Limited Use</em>).
            Google-Nutzerdaten werden <strong>nicht</strong> verkauft, <strong>nicht</strong> für
            Werbung verwendet und <strong>nicht</strong> zum Trainieren von KI- oder
            Machine-Learning-Modellen genutzt.
          </div>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-black text-white">4. Microsoft / Outlook OAuth & weitere Dienste</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Microsoft / Outlook (Microsoft Graph API):</strong> Bei optionaler Verknüpfung
              werden <code>User.Read</code> und <code>Calendars.ReadWrite</code> ausschließlich zur
              Anmeldung und Zwei-Wege-Synchronisation des eigenen Outlook-Kalenders verwendet.
            </li>
            <li>
              <strong>Hosting & Datenbank:</strong> Die Webanwendung wird über <strong>Vercel</strong>{' '}
              ausgeliefert; die Cloud-Speicherung und Echtzeit-Synchronisation erfolgen über{' '}
              <strong>Supabase</strong>.
            </li>
            <li>
              <strong>Optionale Integrationen:</strong> Falls ein Nutzer freiwillig einen Todoist
              API-Token hinterlegt oder den Barcode-/Bon-Scanner nutzt, werden entsprechende Anfragen
              ausschließlich zur Ausführung dieser Funktion an die jeweilige Schnittstelle (z. B.
              Todoist, OpenFoodFacts oder Google Gemini zur Texterkennung von Kassenbons/MHD) übermittelt.
            </li>
          </ul>
        </section>

        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-lg font-black text-white">5. Speicherdauer, Widerruf & Löschung</h2>
          <p>
            Deine Daten bleiben gespeichert, solange dein Familienkonto besteht. Verknüpfte Google- oder
            Microsoft-OAuth-Verbindungen können jederzeit mit einem Klick in der App unter{' '}
            <strong>Konten → Trennen</strong> entfernt werden; dabei werden die gespeicherten OAuth-Tokens
            sofort gelöscht. Zusätzlich kann der Zugriff jederzeit direkt in den Sicherheitseinstellungen
            deines Google-Kontos (<code>myaccount.google.com/permissions</code>) oder Microsoft-Kontos
            widerrufen werden.
          </p>
          <p>
            Zur vollständigen Löschung deines gesamten Kontos oder zur Wahrnehmung deiner Rechte auf
            Auskunft, Berichtigung oder Datenübertragbarkeit (Art. 15–20 DSGVO) genügt eine formlose
            E-Mail an <strong>hgr3dsm@googlemail.com</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
