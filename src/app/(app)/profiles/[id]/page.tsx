import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DeleteProfileDialog } from "@/components/profiles/delete-profile-dialog";
import { getCachedProfile } from "@/lib/cache";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone } from "lucide-react";

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const profile = await getCachedProfile(id);

  if (!profile) {
    notFound();
  }

  // Cualquier usuario autenticado puede ver y editar perfiles
  const canEdit = true; // Todos los usuarios autenticados pueden editar

  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={profile.type === "INFLUENCER" ? "default" : profile.type === "UGC" ? "secondary" : "outline"}>
              {profile.type === "BOTH" ? "Ambos (Influencer + UGC)" : profile.type}
            </Badge>
            <span className="text-sm text-gray-500">
              Creado por {profile.createdBy.name}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/profiles/${profile.id}/edit`}>
              <Button>Editar Perfil</Button>
            </Link>
          )}
          {isAdmin && (
            <DeleteProfileDialog
              profileId={profile.id}
              profileName={profile.name}
            />
          )}
        </div>
      </div>

      {/* Contact Info */}
      {(profile.email || profile.phone) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Datos de Contacto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {profile.email}
                </a>
              )}
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {profile.phone}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Social Accounts & Services */}
      {profile.socialAccounts.map((account) => (
        <Card key={account.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 md:size-12">
                  <AvatarImage
                    src={account.profilePicUrl ?? ""}
                    alt={`Foto de ${account.username}`}
                  />
                  <AvatarFallback>
                    {(account.username?.[0] || "@").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Badge>{account.platform.displayName}</Badge>
                <span className="font-normal">@{account.username}</span>
              </div>
              {account.followers && (
                <span className="text-sm font-normal text-gray-500">
                  {account.followers.toLocaleString()} seguidores
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Metrics */}
            {(account.followers || account.engagementRate) && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {account.followers && (
                    <div>
                      <p className="text-sm text-gray-500">Seguidores</p>
                      <p className="text-lg font-semibold">
                        {account.followers.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {account.following && (
                    <div>
                      <p className="text-sm text-gray-500">Siguiendo</p>
                      <p className="text-lg font-semibold">
                        {account.following.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {account.posts && (
                    <div>
                      <p className="text-sm text-gray-500">Posts</p>
                      <p className="text-lg font-semibold">
                        {account.posts.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {account.avgLikes && account.platform.displayName === "TikTok" && (
                    <div>
                      <p className="text-sm text-gray-500">Me Gusta</p>
                      <p className="text-lg font-semibold">
                        {account.avgLikes?.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Services */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">
                Formatos y Precios
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {account.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <span>{service.serviceType.displayName}</span>
                    <span className="font-semibold">
                      ${formatNumber(Number(service.price))} {service.currency}
                    </span>
                  </div>
                ))}
                {account.services.length === 0 && (
                  <p className="text-gray-500 text-sm col-span-2">
                    No hay formatos con precio definido
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Categories */}
      {profile.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {profile.categories.map((pc) => (
                <Badge key={pc.category.id} variant="outline">
                  {pc.category.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back button */}
      <div className="flex justify-start">
        <Link href="/profiles">
          <Button variant="outline">Volver a Perfiles</Button>
        </Link>
      </div>
    </div>
  );
}
