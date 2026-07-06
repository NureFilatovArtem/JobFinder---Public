import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Monitor, Server, Wrench, Users, Megaphone, BarChart3, Truck, Palette, HeartPulse, GraduationCap } from "lucide-react";

const SKILLS_BY_ROLE = {
  software: [
    { key: "Frontend",      icon: Monitor,      color: "text-blue-500",   bg: "bg-blue-50",   skills: ["React","Vue","Angular","TypeScript","CSS","HTML","Tailwind","Next.js","Svelte","Redux"] },
    { key: "Backend",       icon: Server,       color: "text-violet-500", bg: "bg-violet-50", skills: ["Node.js","Python","Java","Go","PostgreSQL","MongoDB","REST APIs","GraphQL","Redis","Django"] },
    { key: "Tools & DevOps",icon: Wrench,       color: "text-amber-500",  bg: "bg-amber-50",  skills: ["Git","Docker","AWS","CI/CD","Kubernetes","Terraform","Linux","VS Code"] },
    { key: "Soft Skills",   icon: Users,        color: "text-emerald-500",bg: "bg-emerald-50",skills: ["Problem Solving","Teamwork","Communication","Agile","Mentoring","Code Review"] },
  ],
  marketing: [
    { key: "Digital Marketing",  icon: Megaphone, color: "text-pink-500",  bg: "bg-pink-50",  skills: ["SEO","SEM","Google Ads","Meta Ads","Email Marketing","Content Marketing","Affiliate Marketing"] },
    { key: "Analytics & Data",   icon: BarChart3, color: "text-blue-500",  bg: "bg-blue-50",  skills: ["Google Analytics","Mixpanel","A/B Testing","Conversion Optimization","Data Studio","Tableau"] },
    { key: "Tools",              icon: Wrench,    color: "text-amber-500", bg: "bg-amber-50", skills: ["HubSpot","Mailchimp","Salesforce","Hootsuite","Canva","Notion","Asana"] },
    { key: "Soft Skills",        icon: Users,     color: "text-emerald-500",bg:"bg-emerald-50",skills: ["Creativity","Storytelling","Communication","Campaign Management","Brand Strategy","Copywriting"] },
  ],
  sales: [
    { key: "Sales Techniques", icon: BarChart3, color: "text-blue-500",   bg: "bg-blue-50",   skills: ["Cold Outreach","Lead Generation","Closing Deals","Upselling","Account Management","Pipeline Management"] },
    { key: "CRM & Tools",      icon: Wrench,    color: "text-amber-500",  bg: "bg-amber-50",  skills: ["Salesforce","HubSpot CRM","Pipedrive","Outreach.io","LinkedIn Sales Navigator","ZoomInfo"] },
    { key: "Industries",       icon: Server,    color: "text-violet-500", bg: "bg-violet-50", skills: ["SaaS","B2B","B2C","Enterprise","SMB","E-commerce","Financial Services"] },
    { key: "Soft Skills",      icon: Users,     color: "text-emerald-500",bg: "bg-emerald-50",skills: ["Negotiation","Persuasion","Active Listening","Resilience","Relationship Building","Time Management"] },
  ],
  logistics: [
    { key: "Operations",      icon: Truck,  color: "text-orange-500", bg: "bg-orange-50", skills: ["Supply Chain Management","Inventory Control","Warehouse Management","Fleet Management","Last-mile Delivery"] },
    { key: "Tools & Systems", icon: Wrench, color: "text-amber-500",  bg: "bg-amber-50",  skills: ["SAP","Oracle ERP","WMS","TMS","Excel / Sheets","Power BI","AutoCAD"] },
    { key: "Compliance",      icon: Server, color: "text-violet-500", bg: "bg-violet-50", skills: ["Import/Export Regulations","Customs","OSHA","ISO Standards","Hazmat Handling"] },
    { key: "Soft Skills",     icon: Users,  color: "text-emerald-500",bg: "bg-emerald-50",skills: ["Problem Solving","Communication","Teamwork","Attention to Detail","Process Improvement"] },
  ],
  design: [
    { key: "Design Skills", icon: Palette, color: "text-pink-500",  bg: "bg-pink-50",  skills: ["UI Design","UX Research","Wireframing","Prototyping","Visual Design","Motion Design","Brand Identity"] },
    { key: "Tools",         icon: Wrench,  color: "text-amber-500", bg: "bg-amber-50", skills: ["Figma","Adobe XD","Sketch","Illustrator","Photoshop","After Effects","Webflow","Framer"] },
    { key: "Methods",       icon: Monitor, color: "text-blue-500",  bg: "bg-blue-50",  skills: ["Design Systems","Accessibility","Responsive Design","User Testing","A/B Testing","Atomic Design"] },
    { key: "Soft Skills",   icon: Users,   color: "text-emerald-500",bg:"bg-emerald-50",skills: ["Creativity","Empathy","Communication","Storytelling","Collaboration","Attention to Detail"] },
  ],
  healthcare: [
    { key: "Clinical Skills",   icon: HeartPulse, color: "text-red-500",    bg: "bg-red-50",    skills: ["Patient Assessment","Diagnosis","Treatment Planning","Medication Administration","Emergency Care","Wound Care"] },
    { key: "Specializations",   icon: Server,     color: "text-violet-500", bg: "bg-violet-50", skills: ["Cardiology","Pediatrics","Oncology","Orthopedics","Mental Health","Geriatrics","ICU / Critical Care"] },
    { key: "Tools & Systems",   icon: Wrench,     color: "text-amber-500",  bg: "bg-amber-50",  skills: ["EMR / EHR","Epic","Cerner","Medical Coding","ICD-10","HIPAA Compliance"] },
    { key: "Soft Skills",       icon: Users,      color: "text-emerald-500",bg: "bg-emerald-50",skills: ["Empathy","Communication","Teamwork","Attention to Detail","Problem Solving","Resilience"] },
  ],
  education: [
    { key: "Teaching Skills",   icon: GraduationCap, color: "text-indigo-500", bg: "bg-indigo-50", skills: ["Curriculum Design","Lesson Planning","Classroom Management","Differentiated Instruction","Assessment & Grading"] },
    { key: "Subjects",          icon: Server,        color: "text-violet-500",  bg: "bg-violet-50", skills: ["Mathematics","Science","English / Literature","History","Languages","Arts","Physical Education","STEM"] },
    { key: "Tools & Platforms", icon: Wrench,        color: "text-amber-500",   bg: "bg-amber-50",  skills: ["Google Classroom","Canvas","Moodle","Zoom","Microsoft Teams","Kahoot","Quizlet"] },
    { key: "Soft Skills",       icon: Users,         color: "text-emerald-500", bg: "bg-emerald-50",skills: ["Patience","Communication","Empathy","Creativity","Adaptability","Mentoring","Leadership"] },
  ],
  other: [
    { key: "Core Skills",    icon: Wrench,    color: "text-amber-500", bg: "bg-amber-50", skills: ["Project Management","Research","Data Analysis","Reporting","Budgeting","Planning"] },
    { key: "Communication",  icon: Megaphone, color: "text-pink-500",  bg: "bg-pink-50",  skills: ["Public Speaking","Writing","Presentation","Negotiation","Client Relations","Networking"] },
    { key: "Tools",          icon: Monitor,   color: "text-blue-500",  bg: "bg-blue-50",  skills: ["Microsoft Office","Google Workspace","Slack","Notion","Trello","Asana","Zoom"] },
    { key: "Soft Skills",    icon: Users,     color: "text-emerald-500",bg:"bg-emerald-50",skills: ["Leadership","Communication","Teamwork","Problem Solving","Adaptability","Time Management"] },
  ],
};

export default function SkillsStep({ data, onUpdate }) {
  const [customSkill, setCustomSkill] = useState("");
  const skills = data.skills || [];
  const role = data.role || "other";
  const categories = SKILLS_BY_ROLE[role] || SKILLS_BY_ROLE["other"];

  const toggleSkill = (skill) => {
    const updated = skills.includes(skill)
      ? skills.filter((s) => s !== skill)
      : [...skills, skill];
    onUpdate({ skills: updated });
  };

  const addCustomSkill = () => {
    const trimmed = customSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onUpdate({ skills: [...skills, trimmed] });
      setCustomSkill("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 3</p>
        <h2 className="text-3xl font-bold tracking-tight">Pick your skills</h2>
        <p className="text-muted-foreground text-base">
          Select all that apply ·{" "}
          <span className="text-blue-600 font-semibold">{skills.length} selected</span>
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="bg-card rounded-2xl border p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.bg}`}>
                    <Icon className={`w-4 h-4 ${cat.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold">{cat.key}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cat.skills.map((skill) => {
                    const isSelected = skills.includes(skill);
                    return (
                      <motion.button
                        key={skill}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleSkill(skill)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border ${
                          isSelected
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                            : "bg-secondary text-secondary-foreground border-transparent hover:border-blue-600/30 hover:bg-blue-50"
                        }`}
                      >
                        {skill}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Custom skill input */}
      <div className="flex gap-2 max-w-md mx-auto">
        <Input
          placeholder="Add a custom skill..."
          value={customSkill}
          onChange={(e) => setCustomSkill(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomSkill()}
          className="h-11"
        />
        <Button onClick={addCustomSkill} size="icon" className="h-11 w-11 shrink-0" disabled={!customSkill.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Selected skills cloud */}
      <AnimatePresence>
        {skills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card rounded-2xl border p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your selected skills</p>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{skills.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {skills.map((skill) => (
                  <motion.button
                    key={skill}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => toggleSkill(skill)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-600 rounded-lg text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition-colors border border-blue-600/20"
                  >
                    {skill}
                    <X className="w-3 h-3" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
