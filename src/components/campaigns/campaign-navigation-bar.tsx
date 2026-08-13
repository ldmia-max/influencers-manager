"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { useCampaignWizard } from "@/contexts/campaign-wizard-context";
import { useCampaignWizardStore } from "@/stores/campaign-wizard-store";

function getProgressBarColor(percentage: number) {
  if (percentage <= 50) return "bg-green-500";
  if (percentage <= 80) return "bg-yellow-500";
  return "bg-red-500";
}

export function CampaignNavigationBar() {
  const { onPrevious, onNext, onCancel } = useCampaignWizard();
  const currentStep = useCampaignWizardStore((s) => s.currentStep);
  const loading = useCampaignWizardStore((s) => s.loading);
  const budget = useCampaignWizardStore((s) => s.getBudget());
  const totalServicesPrice = useCampaignWizardStore((s) => s.getTotalServicesPrice());
  const selectedProfilesCount = useCampaignWizardStore((s) => s.selectedProfileIds.length);

  const budgetPercentage = budget > 0 ? Math.min((totalServicesPrice / budget) * 100, 100) : 0;
  const available = budget - totalServicesPrice;

  return (
    <div className="sticky bottom-0 bg-white space-y-3 pt-4 pb-4 px-6 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {/* Budget progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-500">Presupuesto</span>
              <span className="font-semibold ml-2">${formatNumber(budget.toString())}</span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Total Formatos</span>
              <span
                className={cn(
                  "font-semibold ml-2",
                  totalServicesPrice > budget ? "text-red-600" : "text-green-600"
                )}
              >
                ${formatNumber(totalServicesPrice.toFixed(0))}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Disponible</span>
              <span
                className={cn(
                  "font-semibold ml-2",
                  available < 0 ? "text-red-600" : "text-gray-700"
                )}
              >
                {available < 0 ? "-" : ""}${formatNumber(Math.abs(available).toFixed(0))}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Perfiles</span>
              <span className="font-semibold ml-2">{selectedProfilesCount}</span>
            </div>
          </div>
          <span
            className={cn(
              "text-xs font-medium",
              budgetPercentage <= 50
                ? "text-green-600"
                : budgetPercentage <= 80
                ? "text-yellow-600"
                : "text-red-600"
            )}
          >
            {budgetPercentage.toFixed(0)}% usado
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              getProgressBarColor(budgetPercentage)
            )}
            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
          />
        </div>
        {totalServicesPrice > budget && (
          <p className="text-xs text-red-600">
            Has excedido el presupuesto por ${formatNumber((totalServicesPrice - budget).toFixed(0))}
          </p>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-end gap-3">
        {currentStep > 1 ? (
          <Button variant="outline" onClick={onPrevious} disabled={loading}>
            <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
          </Button>
        ) : (
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}

        <Button onClick={onNext} disabled={loading}>
          Siguiente <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
