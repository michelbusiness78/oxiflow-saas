interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="bg-[#1B2A4A] py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">Dernière mise à jour : {lastUpdated}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
        <div className="prose-legal">
          {children}
        </div>
      </div>

      <style>{`
        .prose-legal h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1B2A4A;
          margin-top: 2.5rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #EFF6FF;
        }
        .prose-legal h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #1e3a5f;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .prose-legal p {
          font-size: 0.9375rem;
          color: #334155;
          line-height: 1.75;
          margin-bottom: 1rem;
        }
        .prose-legal ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .prose-legal li {
          font-size: 0.9375rem;
          color: #334155;
          line-height: 1.75;
          margin-bottom: 0.25rem;
        }
        .prose-legal .placeholder {
          background: #FEF9C3;
          border: 1px dashed #FCD34D;
          border-radius: 4px;
          padding: 1px 6px;
          font-weight: 600;
          color: #92400E;
          font-size: 0.875rem;
        }
        .prose-legal table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
          font-size: 0.9rem;
        }
        .prose-legal th {
          background: #F8FAFC;
          color: #1B2A4A;
          font-weight: 700;
          padding: 10px 14px;
          text-align: left;
          border: 1px solid #E2E8F0;
        }
        .prose-legal td {
          padding: 9px 14px;
          border: 1px solid #E2E8F0;
          color: #334155;
          vertical-align: top;
        }
        .prose-legal tr:nth-child(even) td {
          background: #F8FAFC;
        }
        .prose-legal a {
          color: #2563EB;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
