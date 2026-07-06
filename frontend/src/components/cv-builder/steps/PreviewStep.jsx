import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Columns, LayoutGrid, Pencil, Camera, Eye, EyeOff, Upload } from "lucide-react";
import { resumeAPI } from "@/api/resume";
import { WIZARD_ROLE_LABELS } from "@/lib/cvDefaults";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const TEMPLATES = [
  { id: "minimal", label: "Minimal", icon: FileText,   desc: "Clean & simple"     },
  { id: "modern",  label: "Modern",  icon: LayoutGrid, desc: "Bold headers"       },
  { id: "compact", label: "Compact", icon: Columns,    desc: "Space efficient"    },
  { id: "manual",  label: "Editor",  icon: Pencil,     desc: "Full manual control" },
];

export default function PreviewStep({ data, onUpdate, initialData }) {
  const template = data.template || "minimal";
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await resumeAPI.uploadPhoto(file);
      onUpdate({ photoUrl: result.photo_url, showPhoto: true });
    } catch {
      // silently fail — photo is optional
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const togglePhoto = async () => {
    const next = !data.showPhoto;
    onUpdate({ showPhoto: next });
    if (data.photoUrl) {
      try { await resumeAPI.togglePhoto(next); } catch {}
    }
  };

  const currentPhotoUrl = data.photoUrl
    ? `${API_URL}${data.photoUrl}`
    : initialData?.picture || null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Final Step</p>
        <h2 className="text-3xl font-bold tracking-tight">Your CV is ready! 🎉</h2>
        <p className="text-muted-foreground text-base">
          Choose a template style, then open in the editor to fine-tune and export
        </p>
      </div>

      {/* Template picker */}
      <div className="flex gap-3 justify-center flex-wrap">
        {TEMPLATES.map((t) => {
          const Icon = t.icon;
          const isSelected = template === t.id;
          return (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onUpdate({ template: t.id })}
              className={`flex flex-col items-center gap-1.5 px-6 py-4 rounded-2xl border-2 text-sm font-medium transition-all min-w-[110px] ${
                isSelected
                  ? "border-blue-600 bg-blue-50 text-blue-600 shadow-lg shadow-blue-600/10"
                  : "border-border bg-card text-muted-foreground hover:border-blue-600/50 hover:shadow-md"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-semibold">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.desc}</span>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5" />}
            </motion.button>
          );
        })}
      </div>

      {/* Photo section — hidden on manual mode */}
      {template !== "manual" && (
        <div className="flex items-center gap-4 p-4 bg-card rounded-2xl border max-w-sm mx-auto">
          <div className="relative shrink-0">
            {currentPhotoUrl ? (
              <img
                src={currentPhotoUrl}
                alt="Profile"
                className={`w-14 h-14 rounded-full object-cover border-2 transition-all ${
                  data.showPhoto ? "border-blue-600 opacity-100" : "border-border opacity-40"
                }`}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Camera className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Profile photo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.showPhoto ? "Shown on CV" : "Hidden from CV"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={togglePhoto}
              disabled={!currentPhotoUrl}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-30 hover:bg-muted"
            >
              {data.showPhoto ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {data.showPhoto ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 transition-all disabled:opacity-50"
            >
              <Upload className="w-3 h-3" />
              {uploading ? "..." : "Upload"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
        </div>
      )}

      {/* Manual mode message */}
      {template === "manual" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center space-y-2 max-w-lg mx-auto"
        >
          <Pencil className="w-8 h-8 text-blue-600 mx-auto" />
          <p className="font-semibold text-blue-900">Opening in full editor</p>
          <p className="text-sm text-blue-700">
            All your wizard data will be pre-filled. You can edit every field, reorder sections,
            change styles, and export your CV when ready.
          </p>
        </motion.div>
      )}

      {/* CV full preview — hidden on manual mode */}
      {template !== "manual" && (
        <motion.div
          key={template}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border shadow-md overflow-hidden"
        >
          <CVFullPreview
            data={data}
            initialData={initialData}
            template={template}
            photoUrl={data.showPhoto ? currentPhotoUrl : null}
          />
        </motion.div>
      )}
    </div>
  );
}

// ─── Full CV preview templates (wizard-only, not connected to PDF pipeline) ───

function CVFullPreview({ data, initialData, template, photoUrl }) {
  const roleName =
    data.role === "other"
      ? data.customRole || "Professional"
      : WIZARD_ROLE_LABELS[data.role] || data.role || "Professional";

  const fullName   = initialData?.name  || "Your Name";
  const email      = initialData?.email || "";
  const phone      = initialData?.phone || "";
  const location   = initialData?.location || "";

  const contactLine = [email, phone, location].filter(Boolean).join("  ·  ");

  const props = { data, roleName, fullName, contactLine, photoUrl };

  if (template === "modern")  return <ModernTemplate  {...props} />;
  if (template === "compact") return <CompactTemplate {...props} />;
  return <MinimalTemplate {...props} />;
}

function SectionHeading({ title, accent }) {
  return (
    <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${accent ? "text-blue-600" : "text-gray-400"}`}>
      {title}
    </h3>
  );
}

function ExpEntry({ exp, compact }) {
  return (
    <div className={`space-y-0.5 ${compact ? "" : "pb-3 border-b last:border-0 last:pb-0"}`}>
      <div className="flex justify-between items-baseline gap-2">
        <p className={`font-semibold ${compact ? "text-[10px]" : "text-xs"} text-gray-900`}>
          {exp.role || "Role"}{" "}
          <span className="font-normal text-gray-500">at {exp.company || "Company"}</span>
        </p>
        <span className="text-[9px] text-gray-400 shrink-0">
          {exp.startDate || "…"} – {exp.endDate || "…"}
        </span>
      </div>
      {exp.achievements?.length > 0 && (
        <ul className={`${compact ? "text-[9px]" : "text-[10px]"} text-gray-500 pl-3.5 space-y-0.5 list-disc`}>
          {exp.achievements.slice(0, 3).map((a, j) => <li key={j}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}

function EduEntry({ edu, compact }) {
  return (
    <div className={`space-y-0.5 ${compact ? "" : "pb-3 border-b last:border-0 last:pb-0"}`}>
      <div className="flex justify-between items-baseline gap-2">
        <p className={`font-semibold ${compact ? "text-[10px]" : "text-xs"} text-gray-900`}>
          {edu.degree || "Degree"}{edu.field ? ` in ${edu.field}` : ""}
        </p>
        <span className="text-[9px] text-gray-400 shrink-0">
          {edu.startDate || "…"} – {edu.endDate || "…"}
        </span>
      </div>
      <p className={`${compact ? "text-[9px]" : "text-[10px]"} text-gray-500`}>
        {edu.institution || "Institution"}
      </p>
    </div>
  );
}

function PhotoCircle({ photoUrl, size = "w-14 h-14" }) {
  if (!photoUrl) return null;
  return (
    <img
      src={photoUrl}
      alt="Profile"
      className={`${size} rounded-full object-cover border-2 border-white shadow-sm shrink-0`}
    />
  );
}

function MinimalTemplate({ data, roleName, fullName, contactLine, photoUrl }) {
  return (
    <div className="p-8 space-y-5 max-w-2xl mx-auto text-[11px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b pb-5">
        <div className="space-y-0.5 flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
          <p className="text-sm font-medium text-blue-600">{roleName}</p>
          {contactLine && <p className="text-[10px] text-gray-500 mt-1">{contactLine}</p>}
          {data.summary && <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">{data.summary}</p>}
        </div>
        <PhotoCircle photoUrl={photoUrl} />
      </div>

      {data.skills?.length > 0 && (
        <div className="space-y-1.5">
          <SectionHeading title="Skills" />
          <div className="flex flex-wrap gap-1">
            {data.skills.map((s) => (
              <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">{s}</span>
            ))}
          </div>
        </div>
      )}

      {data.experiences?.length > 0 && (
        <div className="space-y-1.5">
          <SectionHeading title="Experience" />
          <div className="space-y-2">
            {data.experiences.map((exp, i) => <ExpEntry key={i} exp={exp} />)}
          </div>
        </div>
      )}

      {data.educations?.length > 0 && (
        <div className="space-y-1.5">
          <SectionHeading title="Education" />
          <div className="space-y-2">
            {data.educations.map((edu, i) => <EduEntry key={i} edu={edu} />)}
          </div>
        </div>
      )}

      {data.languages?.length > 0 && (
        <div className="space-y-1.5">
          <SectionHeading title="Languages" />
          <div className="flex flex-wrap gap-3">
            {data.languages.map((l) => (
              <span key={l.language} className="text-[10px] text-gray-700">
                {l.language} <span className="text-gray-400">({l.proficiency})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModernTemplate({ data, roleName, fullName, contactLine, photoUrl }) {
  return (
    <div className="max-w-2xl mx-auto text-[11px]">
      {/* Blue header band */}
      <div className="bg-blue-600 px-8 py-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{fullName}</h2>
            <p className="text-blue-200 text-sm font-medium mt-0.5">{roleName}</p>
            {contactLine && <p className="text-blue-300 text-[10px] mt-1">{contactLine}</p>}
            {data.summary && <p className="text-blue-100 text-[10px] mt-2 leading-relaxed">{data.summary}</p>}
          </div>
          <PhotoCircle photoUrl={photoUrl} size="w-16 h-16" />
        </div>
      </div>

      <div className="p-8 space-y-5">
        {data.skills?.length > 0 && (
          <div className="space-y-1.5">
            <SectionHeading title="Core Skills" accent />
            <div className="flex flex-wrap gap-1">
              {data.skills.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">{s}</span>
              ))}
            </div>
          </div>
        )}
        {data.experiences?.length > 0 && (
          <div className="space-y-1.5">
            <SectionHeading title="Experience" accent />
            <div className="space-y-2">
              {data.experiences.map((exp, i) => <ExpEntry key={i} exp={exp} />)}
            </div>
          </div>
        )}
        {data.educations?.length > 0 && (
          <div className="space-y-1.5">
            <SectionHeading title="Education" accent />
            <div className="space-y-2">
              {data.educations.map((edu, i) => <EduEntry key={i} edu={edu} />)}
            </div>
          </div>
        )}
        {data.languages?.length > 0 && (
          <div className="space-y-1.5">
            <SectionHeading title="Languages" accent />
            <div className="flex flex-wrap gap-3">
              {data.languages.map((l) => (
                <span key={l.language} className="text-[10px] text-gray-700">
                  {l.language} <span className="text-gray-400">({l.proficiency})</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactTemplate({ data, roleName, fullName, contactLine, photoUrl }) {
  return (
    <div className="p-6 max-w-2xl mx-auto grid grid-cols-3 gap-6 text-[10px]">
      {/* Left column */}
      <div className="col-span-1 space-y-4 border-r pr-4">
        <div className="space-y-1">
          {photoUrl && <PhotoCircle photoUrl={photoUrl} size="w-12 h-12" />}
          <h2 className="text-sm font-bold text-gray-900 mt-1">{fullName}</h2>
          <p className="text-[10px] font-medium text-blue-600">{roleName}</p>
          {contactLine && <p className="text-[9px] text-gray-400 mt-0.5 leading-snug">{contactLine}</p>}
        </div>

        {data.skills?.length > 0 && (
          <div className="space-y-1">
            <SectionHeading title="Skills" accent />
            <div className="flex flex-wrap gap-1">
              {data.skills.map((s) => (
                <span key={s} className="text-[9px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}

        {data.languages?.length > 0 && (
          <div className="space-y-1">
            <SectionHeading title="Languages" accent />
            {data.languages.map((l) => (
              <div key={l.language} className="flex justify-between">
                <span>{l.language}</span>
                <span className="text-gray-400">{l.proficiency}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="col-span-2 space-y-4">
        {data.summary && (
          <div>
            <SectionHeading title="Summary" accent />
            <p className="leading-relaxed text-gray-600">{data.summary}</p>
          </div>
        )}
        {data.experiences?.length > 0 && (
          <div className="space-y-2">
            <SectionHeading title="Experience" accent />
            {data.experiences.map((exp, i) => <ExpEntry key={i} exp={exp} compact />)}
          </div>
        )}
        {data.educations?.length > 0 && (
          <div className="space-y-2">
            <SectionHeading title="Education" accent />
            {data.educations.map((edu, i) => <EduEntry key={i} edu={edu} compact />)}
          </div>
        )}
      </div>
    </div>
  );
}
