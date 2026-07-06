import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Code2, BarChart3, Megaphone, Truck, Palette, HeartPulse, GraduationCap, MoreHorizontal } from "lucide-react";

const ROLES = [
  { id: "software",   label: "Software Engineer", icon: Code2,          color: "from-violet-500/10 to-purple-500/10" },
  { id: "marketing",  label: "Marketing",          icon: Megaphone,      color: "from-pink-500/10 to-rose-500/10"    },
  { id: "sales",      label: "Sales",              icon: BarChart3,      color: "from-blue-500/10 to-cyan-500/10"    },
  { id: "logistics",  label: "Logistics",          icon: Truck,          color: "from-amber-500/10 to-orange-500/10" },
  { id: "design",     label: "Design",             icon: Palette,        color: "from-emerald-500/10 to-teal-500/10" },
  { id: "healthcare", label: "Healthcare",         icon: HeartPulse,     color: "from-red-500/10 to-pink-500/10"     },
  { id: "education",  label: "Education",          icon: GraduationCap,  color: "from-indigo-500/10 to-blue-500/10"  },
  { id: "other",      label: "Other",              icon: MoreHorizontal, color: "from-gray-500/10 to-slate-500/10"   },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0  },
};

export default function RoleStep({ data, onUpdate }) {
  const [showCustom, setShowCustom] = useState(data.role === "other");

  const handleSelect = (roleId) => {
    onUpdate({ role: roleId, customRole: roleId === "other" ? data.customRole : "" });
    setShowCustom(roleId === "other");
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 1</p>
        <h2 className="text-3xl font-bold tracking-tight">What's your field?</h2>
        <p className="text-muted-foreground">Select the category that best describes your work</p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = data.role === role.id;

          return (
            <motion.button
              key={role.id}
              variants={cardVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(role.id)}
              className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left group ${
                isSelected
                  ? "border-blue-600 bg-blue-50 shadow-lg shadow-blue-600/10"
                  : "border-border bg-card hover:border-blue-600/50 hover:shadow-md"
              }`}
            >
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="relative space-y-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`block text-sm font-medium ${isSelected ? "text-blue-600" : "text-foreground"}`}>
                  {role.label}
                </span>
              </div>
              {isSelected && (
                <motion.div
                  layoutId="roleIndicator"
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600"
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {showCustom && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
          <Input
            placeholder="Enter your role..."
            value={data.customRole || ""}
            onChange={(e) => onUpdate({ customRole: e.target.value })}
            className="max-w-md mx-auto text-center h-12 text-base"
            autoFocus
          />
        </motion.div>
      )}
    </div>
  );
}
