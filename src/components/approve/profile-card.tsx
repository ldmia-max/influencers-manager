"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AprobarRechazar } from "./aprobar-rechazar";
import { PlatformSection, ServiceData } from "./platform-section";
import { formatNumber } from "@/lib/format";

export interface PlatformData {
  id: string;
  platformName: string;
  username: string;
  followers?: number;
  profilePicUrl?: string;
  isApproved: boolean;
  services: ServiceData[];
}

interface ProfileCardProps {
  id: string;
  profileName: string;
  profileType: string;
  profilePicUrl?: string;
  country?: string;
  city?: string;
  categories?: string[];
  /** true aprobado, false rechazado, null sin decidir todavia. */
  isApproved: boolean | null;
  platforms: PlatformData[];
  onProfileToggle: (id: string, isApproved: boolean) => void;
  onPlatformToggle: (platformId: string, isApproved: boolean) => void;
  onServiceToggle: (serviceId: string, isApproved: boolean) => void;
  onServiceNotesChange?: (serviceId: string, notes: string) => void;
  disabled?: boolean;
}

const profileTypeLabels: Record<string, string> = {
  INFLUENCER: "Influencer",
  UGC: "UGC Creator",
  BOTH: "Influencer / UGC",
};

export function ProfileCard({
  id,
  profileName,
  profileType,
  profilePicUrl,
  country,
  city,
  categories = [],
  isApproved,
  platforms,
  onProfileToggle,
  onPlatformToggle,
  onServiceToggle,
  onServiceNotesChange,
  disabled = false,
}: ProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Tres estados, no dos. Rojo solo para el rechazo; sin decidir se
  // marca en ambar, porque es trabajo que le queda al cliente y tiene
  // que verse de lejos cuando la campana lleva ocho creadores.
  const rechazado = isApproved === false;
  const aprobado = isApproved === true;
  const sinDecidir = isApproved === null;

  /** La red hereda del creador mientras este no este aprobado. */
  const estadoDeLaRed = (propio: boolean): boolean | null =>
    sinDecidir ? null : rechazado ? false : propio;

  // Calculate total for this profile
  const totalApproved = platforms.reduce((profileSum, platform) => {
    if (!platform.isApproved) return profileSum;
    return (
      profileSum +
      platform.services.reduce((serviceSum, service) => {
        if (!service.isApproved) return serviceSum;
        return serviceSum + service.precio * service.quantity;
      }, 0)
    );
  }, 0);

  const location = [city, country].filter(Boolean).join(", ");

  return (
    <Card
      className={`overflow-hidden transition-colors ${
        rechazado
          ? "border-red-200 bg-red-50/30"
          : sinDecidir
            ? "border-amber-300"
            : ""
      }`}
    >
      <CardHeader
        className={`cursor-pointer py-4 ${
          rechazado ? "bg-red-100/30" : sinDecidir ? "bg-amber-50/50" : ""
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`relative flex h-12 w-12 items-center justify-center rounded-full overflow-hidden ${
                rechazado ? "bg-red-100" : "bg-primary/10"
              }`}
            >
              {profilePicUrl ? (
                <Image
                  src={profilePicUrl}
                  alt={profileName}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <User
                  className={`h-6 w-6 ${
                    rechazado ? "text-red-400" : "text-primary"
                  }`}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <AprobarRechazar
                  aprobado={isApproved}
                  onCambio={(v) => onProfileToggle(id, v)}
                  disabled={disabled}
                  etiqueta={`Aprobar o rechazar a ${profileName}`}
                />
                <h3
                  className={`font-semibold ${
                    rechazado ? "text-muted-foreground" : ""
                  }`}
                >
                  {profileName}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {profileTypeLabels[profileType] || profileType}
                </Badge>
                {sinDecidir && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-xs font-normal text-amber-700"
                  >
                    Sin decidir
                  </Badge>
                )}
              </div>
              {location && (
                <p className="text-sm text-muted-foreground mt-1">{location}</p>
              )}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs font-normal">
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p
                className={`font-semibold ${
                  rechazado ? "line-through text-muted-foreground" : ""
                }`}
              >
                ${formatNumber(Math.round(totalApproved))}
              </p>
            </div>
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3">
            {platforms.map((platform) => (
              <PlatformSection
                key={platform.id}
                id={platform.id}
                platformName={platform.platformName}
                username={platform.username}
                followers={platform.followers}
                services={platform.services}
                isApproved={estadoDeLaRed(platform.isApproved)}
                onPlatformToggle={onPlatformToggle}
                onServiceToggle={onServiceToggle}
                onServiceNotesChange={onServiceNotesChange}
                disabled={disabled || !aprobado}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
