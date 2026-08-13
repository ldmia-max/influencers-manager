"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil } from "lucide-react";
import { AddToCartButton } from "@/components/cart";
import { SyncProfileButton } from "@/components/profiles/sync-profile-button";
import { ViewProfileButton } from "@/components/profiles/view-profile-button";
import { DeleteProfileDialog } from "@/components/profiles/delete-profile-dialog";
import { formatCompactNumber, calculateReach } from "@/lib/format";
import { useReachRanges } from "@/hooks/queries/use-reach-ranges";
import type { ProfileWithServices } from "@/models/campaign";

interface ProfileCardWithCartProps {
  profile: ProfileWithServices;
  isAdmin: boolean;
}

export function ProfileCardWithCart({ profile, isAdmin }: ProfileCardWithCartProps) {
  const { data: reachRanges = [] } = useReachRanges();

  return (
    <div className="relative border rounded-lg p-3 flex flex-col items-center text-center gap-2 hover:shadow-md transition-shadow">
      {/* Actions menu */}
      <div className="absolute top-2 right-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Acciones">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <ViewProfileButton profileId={profile.id} />
            <DropdownMenuItem asChild>
              <Link href={`/profiles/${profile.id}/edit`} className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SyncProfileButton
                profileId={profile.id}
                variant="ghost"
                size="sm"
                showLabel={true}
              />
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <div className="flex items-center gap-2 w-full">
                    <DeleteProfileDialog
                      profileId={profile.id}
                      profileName={profile.name}
                      variant="ghost"
                      size="sm"
                      redirectTo="/profiles"
                    />
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Avatar */}
      <Avatar className="size-14">
        <AvatarImage
          src={profile.socialAccounts[0]?.profilePicUrl ?? ""}
          alt={`Foto de ${profile.name}`}
        />
        <AvatarFallback>{profile.name[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* Name & type */}
      <div className="min-w-0 w-full">
        <div className="font-medium text-sm truncate">{profile.name}</div>
        <Badge
          variant={
            profile.type === "INFLUENCER"
              ? "default"
              : profile.type === "UGC"
              ? "secondary"
              : "outline"
          }
          className="text-[10px] mt-1"
        >
          {profile.type === "BOTH" ? "INF + UGC" : profile.type}
        </Badge>
      </div>

      {/* Location */}
      {(profile.country || profile.department || profile.city) && (
        <div className="text-xs text-gray-500 capitalize truncate w-full">
          {[profile.city?.name, profile.department?.name, profile.country?.name]
            .filter(Boolean)
            .join(", ")}
        </div>
      )}

      {/* Social accounts con alcance */}
      <div className="flex flex-col gap-1 w-full items-center">
        {profile.socialAccounts.map((account) => {
          const reach = calculateReach(account.followers ?? null, reachRanges);
          return (
            <span key={account.id} className="text-[10px] text-muted-foreground">
              {account.platform.displayName}: {formatCompactNumber(account.followers)} seg · {formatCompactNumber(reach)} alc
            </span>
          );
        })}
      </div>

      {/* Categories */}
      {profile.categories.length > 0 && (
        <div className="flex items-center justify-center gap-1 flex-wrap w-full">
          {profile.categories.slice(0, 2).map((pc) => (
            <Badge key={pc.category.id} variant="secondary" className="text-[10px] px-1.5">
              {pc.category.name}
            </Badge>
          ))}
          {profile.categories.length > 2 && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              +{profile.categories.length - 2}
            </Badge>
          )}
        </div>
      )}

      {/* Add to Cart Button */}
      <AddToCartButton profile={profile} className="w-full mt-1" />
    </div>
  );
}
