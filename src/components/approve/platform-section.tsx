"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ServiceItem } from "./service-item";
import { calculateReach, formatNumber, getReachPercentage } from "@/lib/format";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import { calculateMarkupPrice } from "@/lib/campaign-utils";

export interface ServiceData {
  id: string;
  serviceName: string;
  quantity: number;
  basePrice: number;
  currency: string;
  isApproved: boolean;
  clientNotes?: string;
}

interface PlatformSectionProps {
  /**
   * Margen congelado de la campana. Se propaga desde el portal en vez
   * de leer la constante global: una campana antigua debe seguir
   * mostrando el margen con el que se aprobo.
   */
  markup: number;
  id: string;
  platformName: string;
  platformIcon?: string;
  username: string;
  followers?: number;
  services: ServiceData[];
  isApproved: boolean;
  onPlatformToggle: (id: string, isApproved: boolean) => void;
  onServiceToggle: (serviceId: string, isApproved: boolean) => void;
  onServiceNotesChange?: (serviceId: string, notes: string) => void;
  disabled?: boolean;
}

function getProfileUrl(platformName: string, username: string): string | null {
  const name = platformName.toLowerCase();
  if (name === "instagram") return `https://www.instagram.com/${username}`;
  if (name === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (name === "youtube") return `https://www.youtube.com/@${username}`;
  return null;
}

export function PlatformSection({
  markup,
  id,
  platformName,
  username,
  followers,
  services,
  isApproved,
  onPlatformToggle,
  onServiceToggle,
  onServiceNotesChange,
  disabled = false,
}: PlatformSectionProps) {
  const { data: reachRanges = [] } = useReachRanges();
  const [isExpanded, setIsExpanded] = useState(true);

  const approvedServices = services.filter((s) => s.isApproved);
  const totalApproved = approvedServices.reduce((sum, s) => {
    return sum + calculateMarkupPrice(s.basePrice, markup) * s.quantity;
  }, 0);
  const reach = calculateReach(followers ?? 0, reachRanges);
  const reachPercent = getReachPercentage(followers ?? 0, reachRanges);

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-colors ${
        isApproved ? "border-border" : "border-red-200 bg-red-50/50"
      }`}
    >
      {/* Platform Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer ${
          isApproved ? "bg-muted/50" : "bg-red-100/50"
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={isApproved}
              onCheckedChange={(checked) => onPlatformToggle(id, checked)}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled}
              className="data-[state=checked]:bg-green-500"
            />
            <span
              className={`font-medium ${
                !isApproved ? "text-muted-foreground" : ""
              }`}
            >
              {platformName}
            </span>
          </div>
          {(() => {
            const profileUrl = getProfileUrl(platformName, username);
            return profileUrl ? (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Badge variant="outline" className="text-xs hover:bg-accent cursor-pointer gap-1">
                  @{username}
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </a>
            ) : (
              <Badge variant="outline" className="text-xs">
                @{username}
              </Badge>
            );
          })()}
          {followers && (
            <div className="text-xs text-muted-foreground">
              <span>{followers.toLocaleString()} seguidores</span>
              <span className="mx-2">|</span>
              <span className="text-green-600">
                {reach?.toLocaleString()} alcance ({reachPercent}%)
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-sm font-medium ${
              !isApproved ? "line-through text-muted-foreground" : ""
            }`}
          >
            ${formatNumber(Math.round(totalApproved))}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Services List */}
      {isExpanded && (
        <div className="p-4 pt-2 space-y-1">
          {services.map((service) => (
            <ServiceItem
              markup={markup}
              key={service.id}
              id={service.id}
              serviceName={service.serviceName}
              quantity={service.quantity}
              basePrice={service.basePrice}
              currency={service.currency}
              isApproved={isApproved && service.isApproved}
              clientNotes={service.clientNotes}
              onToggle={onServiceToggle}
              onNotesChange={onServiceNotesChange}
              disabled={disabled || !isApproved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
