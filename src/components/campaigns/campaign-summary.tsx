"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, DollarSign, Eye } from "lucide-react";
import { formatNumber, formatCompactNumber, calculateReach, type ReachRangeData } from "@/lib/format";
import {
  calculateServiceTotal,
  validateBudget,
  calculateBudgetPercentage,
  calculateRemainingBudget,
} from "@/lib/campaign-utils";
import type { ProfileConfig } from "./platform-service-selector";
import type { ProfileWithServices } from "@/models/campaign";

interface CampaignSummaryProps {
  budget: number;
  profileConfigs: ProfileConfig[];
  profiles?: ProfileWithServices[];
  reachRanges?: ReachRangeData[];
}

export function CampaignSummary({
  budget,
  profileConfigs,
  profiles,
  reachRanges,
}: CampaignSummaryProps) {
  // Calcular totales
  let totalMarkup = 0;
  let totalProfiles = 0;
  let totalReach = 0;

  const formatCounts = new Map<string, number>();
  const genderCounts = new Map<string, number>();
  const departmentCounts = new Map<string, number>();

  profileConfigs.forEach((pc) => {
    let profileHasServices = false;
    const accountsProcessed = new Set<string>();

    pc.platforms.forEach((plat) => {
      if (plat.selected) {
        plat.services.forEach((s) => {
          if (s.quantity > 0) {
            profileHasServices = true;
            formatCounts.set(s.serviceName, (formatCounts.get(s.serviceName) || 0) + s.quantity);
            const { markupTotal } = calculateServiceTotal(
              s.basePrice,
              s.quantity
            );
            totalMarkup += markupTotal;
          }
        });

        // Sumar alcance de cada plataforma seleccionada (una vez por cuenta)
        if (profiles && !accountsProcessed.has(plat.socialAccountId)) {
          accountsProcessed.add(plat.socialAccountId);
          const profile = profiles.find((p) => p.id === pc.profileId);
          const account = profile?.socialAccounts.find(
            (sa) => sa.id === plat.socialAccountId
          );
          const reach = calculateReach(account?.followers ?? null, reachRanges);
          if (reach) totalReach += reach;
        }
      }
    });
    if (profileHasServices) {
      totalProfiles++;

      // Contar géneros y departamentos de perfiles activos
      if (profiles) {
        const profile = profiles.find((p) => p.id === pc.profileId);
        if (profile?.gender) {
          const name = profile.gender.displayName;
          genderCounts.set(name, (genderCounts.get(name) || 0) + 1);
        }
        if (profile?.department) {
          const name = profile.department.name;
          departmentCounts.set(name, (departmentCounts.get(name) || 0) + 1);
        }
      }
    }
  });

  const isWithinBudget = validateBudget(totalMarkup, budget);
  const budgetPercentage = calculateBudgetPercentage(totalMarkup, budget);
  const remainingBudget = calculateRemainingBudget(budget, totalMarkup);

  return (
    <Card className={!isWithinBudget ? "border-red-300 bg-red-50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Resumen
          </CardTitle>
          {totalMarkup > 0 && (
            <Badge variant={isWithinBudget ? "default" : "destructive"}>
              {isWithinBudget ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Dentro del presupuesto
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Excede presupuesto
                </span>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra de progreso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Uso del presupuesto</span>
            <span
              className={`font-medium ${
                budgetPercentage > 100 ? "text-red-600" : ""
              }`}
            >
              {budgetPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={Math.min(budgetPercentage, 100)}
            className={budgetPercentage > 100 ? "[&>div]:bg-red-500" : ""}
          />
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Presupuesto</p>
            <p className="text-xl font-bold">${formatNumber(budget.toString())}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Total</p>
            <p
              className={`text-xl font-bold ${
                !isWithinBudget ? "text-red-600" : "text-green-600"
              }`}
            >
              ${formatNumber(totalMarkup.toFixed(0))}
            </p>
          </div>
          <div className="space-y-1 col-span-2">
            <p className="text-sm text-gray-500">
              {remainingBudget >= 0 ? "Disponible" : "Excedente"}
            </p>
            <p
              className={`text-xl font-bold ${
                remainingBudget >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              ${formatNumber(Math.abs(remainingBudget).toFixed(0))}
            </p>
          </div>
        </div>

        {/* Alcance general */}
        {totalReach > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1.5 text-sm">
              <Eye className="h-4 w-4 text-green-600" />
              Alcance Estimado:
            </span>
            <span className="font-bold text-green-600">
              {formatCompactNumber(totalReach)}{" "}
              <span className="text-sm font-normal text-gray-500">({totalReach.toLocaleString()})</span>
            </span>
          </div>
        )}

        {/* Detalles */}
        <div className="pt-2 border-t space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Perfiles seleccionados:</span>
            <span className="font-medium">{totalProfiles}</span>
          </div>
        </div>

        {/* Formatos */}
        {formatCounts.size > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-sm text-gray-500">Formatos:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...formatCounts.entries()].map(([name, count]) => (
                <Badge key={name} variant="secondary" className="text-xs">
                  {name} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Géneros */}
        {genderCounts.size > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-sm text-gray-500">Géneros:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...genderCounts.entries()].map(([name, count]) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Departamentos */}
        {departmentCounts.size > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-sm text-gray-500">Departamentos:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...departmentCounts.entries()].map(([name, count]) => (
                <Badge key={name} variant="outline" className="text-xs">
                  {name} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Advertencia si excede */}
        {!isWithinBudget && totalMarkup > 0 && (
          <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  El presupuesto ha sido excedido
                </p>
                <p className="text-sm text-red-600">
                  El total excede el presupuesto por $
                  {formatNumber(Math.abs(remainingBudget).toFixed(0))}. Considera
                  ajustar los formatos o aumentar el presupuesto.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
