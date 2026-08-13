"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatNumber, formatCompactNumber } from "@/lib/format";
import { CheckCircle, XCircle, Loader2, Eye } from "lucide-react";

interface ApprovalSummaryProps {
  campaignName: string;
  clientName: string;
  contactName: string;
  budget: number;
  expiresAt: Date;
  originalTotal: number;
  approvedTotal: number;
  removedTotal: number;
  currency: string;
  profilesCount: number;
  approvedProfilesCount: number;
  servicesCount: number;
  approvedServicesCount: number;
  totalReach?: number;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function ApprovalSummary({
  campaignName,
  clientName,
  contactName,
  budget,
  expiresAt,
  originalTotal,
  approvedTotal,
  removedTotal,
  currency,
  profilesCount,
  approvedProfilesCount,
  servicesCount,
  approvedServicesCount,
  totalReach = 0,
  onApproveAll,
  onRejectAll,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: ApprovalSummaryProps) {
  const hasChanges = removedTotal > 0;
  const [currentTime] = useState(() => Date.now());
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - currentTime) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Campaña</p>
          <CardTitle className="text-lg">{campaignName}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {clientName} &middot; {contactName}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="text-sm font-semibold">
              ${formatNumber(budget)} {currency}
            </p>
          </div>
        </div>
        <Separator />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Perfiles</p>
            <p className="font-medium">
              {approvedProfilesCount} / {profilesCount}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Formatos</p>
            <p className="font-medium">
              {approvedServicesCount} / {servicesCount}
            </p>
          </div>
        </div>

        <Separator />

        {/* Alcance general */}
        {totalReach > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Eye className="h-4 w-4 text-green-600" />
                Alcance Estimado
              </span>
              <span className="font-bold text-green-600">
                {formatCompactNumber(totalReach)}{" "}
                <span className="text-xs font-normal text-muted-foreground">({totalReach.toLocaleString()})</span>
              </span>
            </div>
            <Separator />
          </>
        )}

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total original</span>
            <span>${formatNumber(Math.round(originalTotal))} {currency}</span>
          </div>
          {hasChanges && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Items removidos</span>
              <span>-${formatNumber(Math.round(removedTotal))} {currency}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total revisado</span>
            <span className={hasChanges ? "text-green-600" : ""}>
              ${formatNumber(Math.round(approvedTotal))} {currency}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onApproveAll}
            disabled={disabled || isSubmitting}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Aprobar todo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 hover:text-red-700"
            onClick={onRejectAll}
            disabled={disabled || isSubmitting}
          >
            <XCircle className="h-4 w-4 mr-1" />
            Rechazar todo
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={onSubmit}
          disabled={disabled || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar Aprobacion Final"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
