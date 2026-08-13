"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";

interface ChartItem {
  name: string;
  value: number;
}

interface ApprovalChartsProps {
  formats: ChartItem[];
  categories: ChartItem[];
  genders: ChartItem[];
  departments: ChartItem[];
}

const PIE_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-sm px-3 py-2 text-sm">
      <span className="font-medium">{payload[0].name}:</span> {payload[0].value}
    </div>
  );
}

function renderLabel({ name, percent }: { name?: string; percent?: number }) {
  return `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`;
}

export function ApprovalCharts({ formats, categories, genders, departments }: ApprovalChartsProps) {
  const hasFormats = formats.length > 0;
  const hasCategories = categories.length > 0;
  const hasGenders = genders.length > 0;
  const hasDepartments = departments.length > 0;
  console.log(departments)

  if (!hasFormats && !hasCategories && !hasGenders && !hasDepartments) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Formatos - Bar chart */}
      {hasFormats && (
        <Card>
          <CardHeader className="px-4 pb-1 pt-3">
            <CardTitle className="text-sm">Formatos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={formats} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
                <XAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="number" hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Categorías - Pie chart */}
      {hasCategories && (
        <Card>
          <CardHeader className="px-4 pb-1 pt-3">
            <CardTitle className="text-sm">Categorías</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  fontSize={10}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend fontSize={10} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Género - Pie chart */}
      {hasGenders && (
        <Card>
          <CardHeader className="px-4 pb-1 pt-3">
            <CardTitle className="text-sm">Género</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={genders}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  fontSize={10}
                >
                  {genders.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend fontSize={10} iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Departamentos - Horizontal bar chart */}
      {hasDepartments && (
        <Card>
          <CardHeader className="px-4 pb-1 pt-3">
            <CardTitle className="text-sm">Departamentos</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ResponsiveContainer width="100%" height={Math.max(160, departments.length * 28)}>
              <BarChart data={departments} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" fontSize={10} tickLine={false} axisLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="value" position="right" fontSize={11} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
