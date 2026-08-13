import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateCategoryForm } from "@/components/forms/create-category-form";
import { Pagination } from "@/components/ui/pagination";
import { EditCategoryDialog } from "@/components/categories/edit-category-dialog";
import { DeleteCategoryDialog } from "@/components/categories/delete-category-dialog";

interface SearchParams {
  page?: string;
  pageSize?: string;
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const params = await searchParams;

  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  const skip = (page - 1) * pageSize;

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: { profiles: true },
        },
        createdBy: {
          select: { name: true },
        },
      },
    }),
    prisma.category.count(),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Category */}
        <Card>
          <CardHeader>
            <CardTitle>Nueva Categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCategoryForm />
          </CardContent>
        </Card>

        {/* Category List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Categorías Existentes
              {total > 0 && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({total} categoría{total !== 1 ? "s" : ""})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay categorías creadas aún.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{category.name}</p>
                        {category.description && (
                          <p className="text-sm text-gray-500">
                            {category.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {category._count.profiles} perfiles
                        </Badge>
                        {!category.isActive && (
                          <Badge variant="destructive">Inactiva</Badge>
                        )}
                        {isAdmin && (
                          <>
                            <EditCategoryDialog category={category} />
                            <DeleteCategoryDialog
                              categoryId={category.id}
                              categoryName={category.name}
                              profileCount={category._count.profiles}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginación */}
                {categories.length > 0 && (
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    total={total}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
