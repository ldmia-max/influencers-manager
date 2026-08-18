"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PlatformSection, ServiceData } from "./platform-section";
import { formatNumber } from "@/lib/format";
import { calculateMarkupPrice } from "@/lib/campaign-utils";

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
  /**
   * Margen congelado de la campana. Se propaga desde el portal en vez
   * de leer la constante global: una campana antigua debe seguir
   * mostrando el margen con el que se aprobo.
   */
  markup: number;
  id: string;
  profileName: string;
  profileType: string;
  profilePicUrl?: string;
  country?: string;
  city?: string;
  categories?: string[];
  isApproved: boolean;
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
  markup,
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

  // Calculate total for this profile
  const totalApproved = platforms.reduce((profileSum, platform) => {
    if (!platform.isApproved) return profileSum;
    return (
      profileSum +
      platform.services.reduce((serviceSum, service) => {
        if (!service.isApproved) return serviceSum;
        return serviceSum + calculateMarkupPrice(service.basePrice, markup) * service.quantity;
      }, 0)
    );
  }, 0);

  const location = [city, country].filter(Boolean).join(", ");

  return (
    <Card
      className={`overflow-hidden transition-colors ${
        isApproved ? "" : "border-red-200 bg-red-50/30"
      }`}
    >
      <CardHeader
        className={`cursor-pointer py-4 ${
          isApproved ? "" : "bg-red-100/30"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`relative flex h-12 w-12 items-center justify-center rounded-full overflow-hidden ${
                isApproved ? "bg-primary/10" : "bg-red-100"
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
                    isApproved ? "text-primary" : "text-red-400"
                  }`}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={isApproved}
                  onCheckedChange={(checked) => onProfileToggle(id, checked)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                  className="data-[state=checked]:bg-green-500"
                />
                <h3
                  className={`font-semibold ${
                    !isApproved ? "text-muted-foreground" : ""
                  }`}
                >
                  {profileName}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {profileTypeLabels[profileType] || profileType}
                </Badge>
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
                  !isApproved ? "line-through text-muted-foreground" : ""
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
                markup={markup}
                key={platform.id}
                id={platform.id}
                platformName={platform.platformName}
                username={platform.username}
                followers={platform.followers}
                services={platform.services}
                isApproved={isApproved && platform.isApproved}
                onPlatformToggle={onPlatformToggle}
                onServiceToggle={onServiceToggle}
                onServiceNotesChange={onServiceNotesChange}
                disabled={disabled || !isApproved}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
