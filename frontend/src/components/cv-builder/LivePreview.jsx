import { motion } from "framer-motion";
import { Eye } from "lucide-react";

export default function LivePreview({ data, initialData }) {
  const roleName = data.role === "other"
    ? (data.customRole || "Your Role")
    : (data.role || "Your Role");
  const fullName = initialData?.name || "";

  const hasContent = data.role || data.skills?.length > 0 || data.experiences?.length > 0;

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
        <Eye className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4">
          {!hasContent ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-3xl mb-2">📄</div>
              <p className="text-xs">Start building to see your CV here</p>
            </div>
          ) : (
            <motion.div
              key={JSON.stringify(data).slice(0, 50)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Role header */}
              <div className="space-y-1">
                {fullName && <p className="text-xs font-bold text-foreground">{fullName}</p>}
                <h3 className="text-sm font-semibold capitalize text-muted-foreground">{roleName}</h3>
                {data.experienceLevel && (
                  <p className="text-xs text-muted-foreground">{data.experienceLevel} years experience</p>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Summary */}
              {data.summary && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Summary</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-4">{data.summary}</p>
                </div>
              )}

              {/* Skills */}
              {data.skills?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {data.skills.slice(0, 12).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                        {s}
                      </span>
                    ))}
                    {data.skills.length > 12 && (
                      <span className="text-[10px] text-muted-foreground">+{data.skills.length - 12} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Experience */}
              {data.experiences?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Experience</p>
                  {data.experiences.map((exp, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-[11px] font-semibold">
                        {exp.role || "Role"}{" "}
                        <span className="font-normal text-muted-foreground">@ {exp.company || "Company"}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {exp.startDate || "..."} – {exp.endDate || "..."}
                      </p>
                      {exp.achievements?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {exp.achievements.slice(0, 3).map((a, j) => (
                            <span key={j} className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded">{a}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Education */}
              {data.educations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Education</p>
                  {data.educations.map((edu, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-[11px] font-semibold">
                        {edu.degree || "Degree"}{edu.field ? ` in ${edu.field}` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {edu.institution || "Institution"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {edu.startDate || "..."} – {edu.endDate || "..."}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Languages */}
              {data.languages?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Languages</p>
                  <div className="space-y-0.5">
                    {data.languages.map((l) => (
                      <div key={l.language} className="flex justify-between text-[11px]">
                        <span>{l.language}</span>
                        <span className="text-muted-foreground font-medium">{l.proficiency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
