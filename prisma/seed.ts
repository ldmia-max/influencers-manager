import { PrismaClient, ProfileType } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============ CREAR USUARIO ADMIN ============
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Administrador",
      role: "ADMIN",
    },
  });
  console.log("Admin user created:", adminUser.email);

  // ============ CREAR PLATAFORMAS SOCIALES ============
  const platforms = [
    { name: "instagram", displayName: "Instagram", icon: "instagram" },
    { name: "tiktok", displayName: "TikTok", icon: "tiktok" },
    // YouTube y Kick no tienen sincronizacion con Apify: el despacho de
    // src/lib/apify.ts solo contempla instagram y tiktok, y cualquier
    // otra plataforma se salta en silencio. Sus cuentas se crean y se
    // les pone precio a mano, pero no traen metricas ni foto.
    { name: "youtube", displayName: "YouTube", icon: "youtube" },
    { name: "kick", displayName: "Kick", icon: "kick" },
  ];

  const createdPlatforms: Record<string, { id: string }> = {};

  for (const platform of platforms) {
    const created = await prisma.socialPlatform.upsert({
      where: { name: platform.name },
      update: {},
      create: platform,
    });
    createdPlatforms[platform.name] = created;
    console.log("Platform created:", created.displayName);
  }

  // ============ CREAR TIPOS DE SERVICIO ============
  const serviceTypes = [
    // Instagram - Influencer (tambien disponible para BOTH)
    {
      name: "reel",
      displayName: "Reel",
      platformName: "instagram",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "reel_colaboracion",
      displayName: "Reel - Colaboracion",
      platformName: "instagram",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "post",
      displayName: "Post",
      platformName: "instagram",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "story",
      displayName: "Story",
      platformName: "instagram",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.UGC, ProfileType.BOTH],
    },
    {
      name: "carrusel",
      displayName: "Carrusel",
      platformName: "instagram",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    // Instagram - UGC (tambien disponible para BOTH)
    {
      name: "ugc_video",
      displayName: "Video UGC",
      platformName: "instagram",
      profileTypes: [ProfileType.UGC, ProfileType.BOTH],
    },
    {
      name: "ugc_foto",
      displayName: "Foto UGC",
      platformName: "instagram",
      profileTypes: [ProfileType.UGC, ProfileType.BOTH],
    },
    // TikTok - Influencer (tambien disponible para BOTH)
    {
      name: "reel",
      displayName: "Video",
      platformName: "tiktok",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "reel_colaboracion",
      displayName: "Video - Colaboracion",
      platformName: "tiktok",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "live",
      displayName: "Live",
      platformName: "tiktok",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    // TikTok - UGC (tambien disponible para BOTH)
    {
      name: "ugc_video",
      displayName: "Video UGC",
      platformName: "tiktok",
      profileTypes: [ProfileType.UGC, ProfileType.BOTH],
    },
    // YouTube - Influencer (tambien disponible para BOTH)
    {
      name: "video",
      displayName: "Video",
      platformName: "youtube",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "video_colaboracion",
      displayName: "Video - Colaboracion",
      platformName: "youtube",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "short",
      displayName: "Short",
      platformName: "youtube",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "mencion",
      displayName: "Mencion",
      platformName: "youtube",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    // YouTube - UGC (tambien disponible para BOTH)
    {
      name: "ugc_video",
      displayName: "Video UGC",
      platformName: "youtube",
      profileTypes: [ProfileType.UGC, ProfileType.BOTH],
    },
    // Kick - Influencer (tambien disponible para BOTH)
    {
      name: "live",
      displayName: "Live",
      platformName: "kick",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "mencion_live",
      displayName: "Mencion en Live",
      platformName: "kick",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    {
      name: "clip",
      displayName: "Clip",
      platformName: "kick",
      profileTypes: [ProfileType.INFLUENCER, ProfileType.BOTH],
    },
    // Kick - UGC (tambien disponible para BOTH)
    {
      name: "ugc_video",
      displayName: "Video UGC",
      platformName: "kick",
      profileTypes: [ProfileType.UGC, ProfileType.BOTH],
    },
  ];

  for (const serviceType of serviceTypes) {
    const platform = createdPlatforms[serviceType.platformName];
    if (!platform) continue;

    await prisma.serviceType.upsert({
      where: {
        name_platformId: {
          name: serviceType.name,
          platformId: platform.id,
        },
      },
      update: {},
      create: {
        name: serviceType.name,
        displayName: serviceType.displayName,
        platformId: platform.id,
        profileTypes: serviceType.profileTypes,
      },
    });
    console.log(
      `Service type created: ${serviceType.displayName} (${serviceType.platformName})`
    );
  }

  // ============ CREAR GENEROS ============
  const genders = [
    { name: "femenino", displayName: "Femenino" },
    { name: "masculino", displayName: "Masculino" },
  ];

  for (const gender of genders) {
    await prisma.gender.upsert({
      where: { name: gender.name },
      update: {},
      create: gender,
    });
    console.log("Gender created:", gender.displayName);
  }

  // ============ CREAR CATEGORIAS INICIALES ============
  const categories = [
    { name: "Foodie", slug: "foodie", description: "Contenido de comida y gastronomia" },
    { name: "Tecnologia", slug: "tecnologia", description: "Contenido de tecnologia y gadgets" },
    { name: "Moda", slug: "moda", description: "Contenido de moda y estilo" },
    { name: "Fitness", slug: "fitness", description: "Contenido de ejercicio y vida saludable" },
    { name: "Viajes", slug: "viajes", description: "Contenido de viajes y turismo" },
    { name: "Belleza", slug: "belleza", description: "Contenido de maquillaje y cuidado personal" },
    { name: "Gaming", slug: "gaming", description: "Contenido de videojuegos" },
    { name: "Lifestyle", slug: "lifestyle", description: "Contenido de estilo de vida" },
    // Nichos incorporados desde el brief de campana
    { name: "Humor", slug: "humor", description: "Contenido de comedia y entretenimiento" },
    { name: "Motos", slug: "motos", description: "Contenido de motociclismo y vehiculos" },
    { name: "Deportes", slug: "deportes", description: "Contenido deportivo" },
    { name: "Estudio - Academico", slug: "estudio-academico", description: "Contenido educativo y academico" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: {
        ...category,
        createdById: adminUser.id,
      },
    });
    console.log("Category created:", category.name);
  }

  // ============ CREAR RANGOS DE ALCANCE ============
  const reachRanges = [
    {
      name: "nano",
      displayName: "Nano Influencer",
      minFollowers: 1000,
      maxFollowers: 10000,
      reachPercentage: 0.5, // 50%
    },
    {
      name: "micro",
      displayName: "Micro Influencer",
      minFollowers: 10001,
      maxFollowers: 50000,
      reachPercentage: 0.45, // 45%
    },
    {
      name: "mid",
      displayName: "Mid-tier Influencer",
      minFollowers: 50001,
      maxFollowers: 100000,
      reachPercentage: 0.4, // 40%
    },
    {
      name: "macro",
      displayName: "Macro Influencer",
      minFollowers: 100001,
      maxFollowers: 500000,
      reachPercentage: 0.3, // 30%
    },
    {
      name: "mega",
      displayName: "Mega Influencer",
      minFollowers: 500001,
      maxFollowers: null, // Sin límite superior
      reachPercentage: 0.2, // 20%
    },
  ];

  for (const range of reachRanges) {
    await prisma.reachRange.upsert({
      where: { name: range.name },
      update: {},
      create: range,
    });
    console.log("Reach range created:", range.displayName);
  }

  // ============ CREAR PAISES ============
  const countries = [
    { name: "Colombia", code: "CO" },
    { name: "México", code: "MX" },
    { name: "Argentina", code: "AR" },
    { name: "Chile", code: "CL" },
    { name: "Perú", code: "PE" },
    { name: "Ecuador", code: "EC" },
    { name: "España", code: "ES" },
    { name: "Estados Unidos", code: "US" },
  ];

  const createdCountries: Record<string, { id: string }> = {};

  for (const country of countries) {
    const created = await prisma.country.upsert({
      where: { code: country.code },
      update: {},
      create: country,
    });
    createdCountries[country.code] = created;
    console.log("Country created:", country.name);
  }

  // ============ CREAR DEPARTAMENTOS DE COLOMBIA ============
  const colombiaDepartments = [
    { name: "Amazonas", code: "AMA" },
    { name: "Antioquia", code: "ANT" },
    { name: "Arauca", code: "ARA" },
    { name: "Atlántico", code: "ATL" },
    { name: "Bogotá D.C.", code: "DC" },
    { name: "Bolívar", code: "BOL" },
    { name: "Boyacá", code: "BOY" },
    { name: "Caldas", code: "CAL" },
    { name: "Caquetá", code: "CAQ" },
    { name: "Casanare", code: "CAS" },
    { name: "Cauca", code: "CAU" },
    { name: "Cesar", code: "CES" },
    { name: "Chocó", code: "CHO" },
    { name: "Córdoba", code: "COR" },
    { name: "Cundinamarca", code: "CUN" },
    { name: "Guainía", code: "GUA" },
    { name: "Guaviare", code: "GUV" },
    { name: "Huila", code: "HUI" },
    { name: "La Guajira", code: "LAG" },
    { name: "Magdalena", code: "MAG" },
    { name: "Meta", code: "MET" },
    { name: "Nariño", code: "NAR" },
    { name: "Norte de Santander", code: "NSA" },
    { name: "Putumayo", code: "PUT" },
    { name: "Quindío", code: "QUI" },
    { name: "Risaralda", code: "RIS" },
    { name: "San Andrés y Providencia", code: "SAP" },
    { name: "Santander", code: "SAN" },
    { name: "Sucre", code: "SUC" },
    { name: "Tolima", code: "TOL" },
    { name: "Valle del Cauca", code: "VAC" },
    { name: "Vaupés", code: "VAU" },
    { name: "Vichada", code: "VIC" },
  ];

  const createdDepartments: Record<string, { id: string }> = {};
  const colombiaId = createdCountries["CO"]?.id;

  if (colombiaId) {
    for (const dept of colombiaDepartments) {
      const created = await prisma.department.upsert({
        where: {
          name_countryId: {
            name: dept.name,
            countryId: colombiaId,
          },
        },
        update: {},
        create: {
          name: dept.name,
          code: dept.code,
          countryId: colombiaId,
        },
      });
      createdDepartments[dept.code] = created;
      console.log("Department created:", dept.name);
    }
  }

  // ============ CREAR CIUDADES PRINCIPALES DE COLOMBIA ============
  const colombiaCities = [
    // Bogotá D.C.
    { name: "Bogotá", departmentCode: "DC" },
    // Antioquia
    { name: "Medellín", departmentCode: "ANT" },
    { name: "Envigado", departmentCode: "ANT" },
    { name: "Bello", departmentCode: "ANT" },
    { name: "Itagüí", departmentCode: "ANT" },
    { name: "Rionegro", departmentCode: "ANT" },
    // Atlántico
    { name: "Barranquilla", departmentCode: "ATL" },
    { name: "Soledad", departmentCode: "ATL" },
    // Valle del Cauca
    { name: "Cali", departmentCode: "VAC" },
    { name: "Palmira", departmentCode: "VAC" },
    { name: "Buenaventura", departmentCode: "VAC" },
    // Santander
    { name: "Bucaramanga", departmentCode: "SAN" },
    { name: "Floridablanca", departmentCode: "SAN" },
    { name: "Girón", departmentCode: "SAN" },
    // Bolívar
    { name: "Cartagena", departmentCode: "BOL" },
    // Norte de Santander
    { name: "Cúcuta", departmentCode: "NSA" },
    // Cundinamarca
    { name: "Soacha", departmentCode: "CUN" },
    { name: "Chía", departmentCode: "CUN" },
    { name: "Zipaquirá", departmentCode: "CUN" },
    // Risaralda
    { name: "Pereira", departmentCode: "RIS" },
    { name: "Dosquebradas", departmentCode: "RIS" },
    // Tolima
    { name: "Ibagué", departmentCode: "TOL" },
    // Huila
    { name: "Neiva", departmentCode: "HUI" },
    // Meta
    { name: "Villavicencio", departmentCode: "MET" },
    // Caldas
    { name: "Manizales", departmentCode: "CAL" },
    // Magdalena
    { name: "Santa Marta", departmentCode: "MAG" },
    // Nariño
    { name: "Pasto", departmentCode: "NAR" },
    // Córdoba
    { name: "Montería", departmentCode: "COR" },
    // Quindío
    { name: "Armenia", departmentCode: "QUI" },
    // Cesar
    { name: "Valledupar", departmentCode: "CES" },
    // Boyacá
    { name: "Tunja", departmentCode: "BOY" },
    // Cauca
    { name: "Popayán", departmentCode: "CAU" },
    // La Guajira
    { name: "Riohacha", departmentCode: "LAG" },
  ];

  const createdCities: Record<string, { id: string }> = {};

  for (const city of colombiaCities) {
    const department = createdDepartments[city.departmentCode];
    if (!department) continue;

    const created = await prisma.city.upsert({
      where: {
        name_departmentId: {
          name: city.name,
          departmentId: department.id,
        },
      },
      update: {},
      create: {
        name: city.name,
        departmentId: department.id,
      },
    });
    createdCities[city.name] = created;
    console.log("City created:", city.name);
  }

  // ============ OBTENER REFERENCIAS PARA PERFILES ============
  const genderFemenino = await prisma.gender.findUnique({ where: { name: "femenino" } });
  const genderMasculino = await prisma.gender.findUnique({ where: { name: "masculino" } });
  const categoryFoodie = await prisma.category.findUnique({ where: { slug: "foodie" } });
  const categoryModa = await prisma.category.findUnique({ where: { slug: "moda" } });
  const categoryFitness = await prisma.category.findUnique({ where: { slug: "fitness" } });
  const categoryBelleza = await prisma.category.findUnique({ where: { slug: "belleza" } });
  const categoryLifestyle = await prisma.category.findUnique({ where: { slug: "lifestyle" } });
  const categoryViajes = await prisma.category.findUnique({ where: { slug: "viajes" } });

  // Obtener tipos de servicio
  const instagramPlatform = createdPlatforms["instagram"];
  const tiktokPlatform = createdPlatforms["tiktok"];

  const serviceTypeReel = await prisma.serviceType.findFirst({
    where: { name: "reel", platformId: instagramPlatform.id },
  });
  const serviceTypeStory = await prisma.serviceType.findFirst({
    where: { name: "story", platformId: instagramPlatform.id },
  });
  const serviceTypePost = await prisma.serviceType.findFirst({
    where: { name: "post", platformId: instagramPlatform.id },
  });
  const serviceTypeCarrusel = await prisma.serviceType.findFirst({
    where: { name: "carrusel", platformId: instagramPlatform.id },
  });
  const serviceTypeTiktokVideo = await prisma.serviceType.findFirst({
    where: { name: "reel", platformId: tiktokPlatform.id },
  });
  const serviceTypeUgcVideo = await prisma.serviceType.findFirst({
    where: { name: "ugc_video", platformId: instagramPlatform.id },
  });

  // ============ DATOS DE EJEMPLO ============
  // Todo lo anterior son datos de catalogo (usuario admin, plataformas,
  // tipos de servicio, categorias, generos, ubicaciones y rangos de
  // alcance) y hace falta en cualquier entorno.
  //
  // Lo que viene a continuacion son perfiles, clientes y campanas
  // INVENTADOS, utiles en local pero que no deben acabar en produccion.
  // Con SEED_DEMO=false el seed termina aqui.
  if (process.env.SEED_DEMO === "false") {
    console.log("\nSEED_DEMO=false: se omiten los datos de ejemplo.");
    console.log("\nSeeding completed!");
    return;
  }

  console.log("\nCreando perfiles de ejemplo...");

  const profilesData = [
    {
      name: "María García",
      type: ProfileType.INFLUENCER,
      genderId: genderFemenino?.id,
      countryId: colombiaId,
      departmentId: createdDepartments["ANT"]?.id,
      cityId: createdCities["Medellín"]?.id,
      categories: [categoryModa?.id, categoryBelleza?.id],
      instagram: {
        username: "mariagarcia_style",
        followers: 125000,
        following: 890,
        posts: 342,
        engagementRate: 4.2,
        biography: "Fashion & Beauty lover | Medellín",
        services: [
          { serviceTypeId: serviceTypeReel?.id, price: 800000 },
          { serviceTypeId: serviceTypeStory?.id, price: 250000 },
          { serviceTypeId: serviceTypePost?.id, price: 500000 },
        ],
      },
      tiktok: {
        username: "mariagarcia_style",
        followers: 85000,
        following: 120,
        posts: 156,
        avgViews: 45000,
        engagementRate: 5.8,
        services: [{ serviceTypeId: serviceTypeTiktokVideo?.id, price: 600000 }],
      },
    },
    {
      name: "Carlos Rodríguez",
      type: ProfileType.INFLUENCER,
      genderId: genderMasculino?.id,
      countryId: colombiaId,
      departmentId: createdDepartments["DC"]?.id,
      cityId: createdCities["Bogotá"]?.id,
      categories: [categoryFitness?.id, categoryLifestyle?.id],
      instagram: {
        username: "carlosfit_co",
        followers: 78000,
        following: 450,
        posts: 289,
        engagementRate: 5.1,
        biography: "Personal Trainer | Transformando vidas | Bogotá",
        services: [
          { serviceTypeId: serviceTypeReel?.id, price: 500000 },
          { serviceTypeId: serviceTypeStory?.id, price: 180000 },
          { serviceTypeId: serviceTypeCarrusel?.id, price: 400000 },
        ],
      },
    },
    {
      name: "Valentina López",
      type: ProfileType.BOTH,
      genderId: genderFemenino?.id,
      countryId: colombiaId,
      departmentId: createdDepartments["VAC"]?.id,
      cityId: createdCities["Cali"]?.id,
      categories: [categoryFoodie?.id, categoryViajes?.id],
      instagram: {
        username: "vale_foodie",
        followers: 45000,
        following: 620,
        posts: 198,
        engagementRate: 6.3,
        biography: "Explorando sabores | Food blogger | Cali",
        services: [
          { serviceTypeId: serviceTypeReel?.id, price: 350000 },
          { serviceTypeId: serviceTypeStory?.id, price: 120000 },
          { serviceTypeId: serviceTypeUgcVideo?.id, price: 280000 },
        ],
      },
      tiktok: {
        username: "vale_foodie",
        followers: 62000,
        following: 89,
        posts: 234,
        avgViews: 35000,
        engagementRate: 7.2,
        services: [{ serviceTypeId: serviceTypeTiktokVideo?.id, price: 400000 }],
      },
    },
    {
      name: "Andrés Martínez",
      type: ProfileType.INFLUENCER,
      genderId: genderMasculino?.id,
      countryId: colombiaId,
      departmentId: createdDepartments["ATL"]?.id,
      cityId: createdCities["Barranquilla"]?.id,
      categories: [categoryLifestyle?.id, categoryViajes?.id],
      instagram: {
        username: "andres_lifestyle",
        followers: 210000,
        following: 340,
        posts: 456,
        engagementRate: 3.8,
        biography: "Lifestyle | Travel | Barranquilla",
        services: [
          { serviceTypeId: serviceTypeReel?.id, price: 1200000 },
          { serviceTypeId: serviceTypeStory?.id, price: 350000 },
          { serviceTypeId: serviceTypePost?.id, price: 800000 },
        ],
      },
    },
    {
      name: "Sofía Hernández",
      type: ProfileType.UGC,
      genderId: genderFemenino?.id,
      countryId: colombiaId,
      departmentId: createdDepartments["SAN"]?.id,
      cityId: createdCities["Bucaramanga"]?.id,
      categories: [categoryBelleza?.id, categoryModa?.id],
      instagram: {
        username: "sofia_ugc",
        followers: 12000,
        following: 890,
        posts: 87,
        engagementRate: 8.5,
        biography: "UGC Creator | Skincare & Makeup",
        services: [
          { serviceTypeId: serviceTypeUgcVideo?.id, price: 350000 },
          { serviceTypeId: serviceTypeStory?.id, price: 80000 },
        ],
      },
    },
  ];

  const createdProfiles: Array<{ id: string; name: string }> = [];

  for (const profileData of profilesData) {
    // Verificar si el perfil ya existe por nombre
    const existingProfile = await prisma.profile.findFirst({
      where: { name: profileData.name, createdById: adminUser.id },
    });

    if (existingProfile) {
      console.log(`Profile already exists: ${profileData.name}`);
      createdProfiles.push(existingProfile);
      continue;
    }

    // Crear perfil
    const profile = await prisma.profile.create({
      data: {
        name: profileData.name,
        type: profileData.type,
        createdById: adminUser.id,
        genderId: profileData.genderId,
        countryId: profileData.countryId,
        departmentId: profileData.departmentId,
        cityId: profileData.cityId,
      },
    });

    // Asignar categorías
    if (profileData.categories) {
      for (const categoryId of profileData.categories) {
        if (categoryId) {
          await prisma.profileCategory.create({
            data: {
              profileId: profile.id,
              categoryId: categoryId,
            },
          });
        }
      }
    }

    // Crear cuenta de Instagram
    if (profileData.instagram) {
      const igAccount = await prisma.socialAccount.create({
        data: {
          profileId: profile.id,
          platformId: instagramPlatform.id,
          username: profileData.instagram.username,
          followers: profileData.instagram.followers,
          following: profileData.instagram.following,
          posts: profileData.instagram.posts,
          engagementRate: profileData.instagram.engagementRate,
          biography: profileData.instagram.biography,
          profileUrl: `https://instagram.com/${profileData.instagram.username}`,
        },
      });

      // Crear servicios de Instagram
      for (const service of profileData.instagram.services) {
        if (service.serviceTypeId) {
          await prisma.profileService.create({
            data: {
              socialAccountId: igAccount.id,
              serviceTypeId: service.serviceTypeId,
              price: service.price,
              currency: "COP",
            },
          });
        }
      }
    }

    // Crear cuenta de TikTok
    if (profileData.tiktok) {
      const tkAccount = await prisma.socialAccount.create({
        data: {
          profileId: profile.id,
          platformId: tiktokPlatform.id,
          username: profileData.tiktok.username,
          followers: profileData.tiktok.followers,
          following: profileData.tiktok.following,
          posts: profileData.tiktok.posts,
          avgViews: profileData.tiktok.avgViews,
          engagementRate: profileData.tiktok.engagementRate,
          profileUrl: `https://tiktok.com/@${profileData.tiktok.username}`,
        },
      });

      // Crear servicios de TikTok
      for (const service of profileData.tiktok.services) {
        if (service.serviceTypeId) {
          await prisma.profileService.create({
            data: {
              socialAccountId: tkAccount.id,
              serviceTypeId: service.serviceTypeId,
              price: service.price,
              currency: "COP",
            },
          });
        }
      }
    }

    createdProfiles.push(profile);
    console.log(`Profile created: ${profile.name}`);
  }

  // ============ CREAR CLIENTES DE EJEMPLO ============
  console.log("\nCreando clientes de ejemplo...");

  const clientsData = [
    {
      companyName: "Moda Express S.A.S",
      nit: "900123456-7",
      email: "contacto@modaexpress.co",
      contacts: [
        {
          firstName: "Laura",
          lastName: "Gómez",
          email: "laura.gomez@modaexpress.co",
          phone: "+57 300 123 4567",
          position: "Gerente de Marketing",
          isPrimary: true,
        },
        {
          firstName: "Pedro",
          lastName: "Sánchez",
          email: "pedro.sanchez@modaexpress.co",
          phone: "+57 300 987 6543",
          position: "Coordinador Digital",
          isPrimary: false,
        },
      ],
    },
    {
      companyName: "Restaurante El Sabor",
      nit: "800987654-3",
      email: "info@elsabor.com.co",
      contacts: [
        {
          firstName: "Juan",
          lastName: "Pérez",
          email: "juan.perez@elsabor.com.co",
          phone: "+57 311 222 3333",
          position: "Dueño",
          isPrimary: true,
        },
      ],
    },
    {
      companyName: "FitLife Colombia",
      nit: "901234567-8",
      email: "marketing@fitlife.co",
      contacts: [
        {
          firstName: "Carolina",
          lastName: "Ruiz",
          email: "carolina.ruiz@fitlife.co",
          phone: "+57 315 444 5555",
          position: "Directora de Marketing",
          isPrimary: true,
        },
      ],
    },
  ];

  const createdClients: Array<{ id: string; companyName: string; contactId: string }> = [];

  for (const clientData of clientsData) {
    const existingClient = await prisma.client.findUnique({
      where: { email: clientData.email },
    });

    if (existingClient) {
      const primaryContact = await prisma.clientContact.findFirst({
        where: { clientId: existingClient.id, isPrimary: true },
      });
      console.log(`Client already exists: ${clientData.companyName}`);
      createdClients.push({
        id: existingClient.id,
        companyName: existingClient.companyName,
        contactId: primaryContact?.id || "",
      });
      continue;
    }

    const client = await prisma.client.create({
      data: {
        companyName: clientData.companyName,
        nit: clientData.nit,
        email: clientData.email,
        createdById: adminUser.id,
      },
    });

    let primaryContactId = "";

    for (const contact of clientData.contacts) {
      const createdContact = await prisma.clientContact.create({
        data: {
          clientId: client.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          position: contact.position,
          isPrimary: contact.isPrimary,
        },
      });
      if (contact.isPrimary) {
        primaryContactId = createdContact.id;
      }
    }

    createdClients.push({
      id: client.id,
      companyName: client.companyName,
      contactId: primaryContactId,
    });
    console.log(`Client created: ${client.companyName}`);
  }

  // ============ CREAR CAMPAÑAS DE EJEMPLO ============
  console.log("\nCreando campañas de ejemplo...");

  if (createdClients.length > 0 && createdProfiles.length > 0) {
    const campaignsData = [
      {
        name: "Campaña Verano 2024",
        description: "Promoción de nueva colección de verano",
        status: "DRAFT" as const,
        budget: 5000000,
        clientIndex: 0,
        startDate: new Date("2024-06-01"),
        endDate: new Date("2024-06-30"),
        profileIndices: [0, 2], // María García, Valentina López
      },
      {
        name: "Lanzamiento Menú Especial",
        description: "Promoción del nuevo menú del restaurante",
        status: "ACTIVE" as const,
        budget: 2500000,
        clientIndex: 1,
        startDate: new Date("2024-05-15"),
        endDate: new Date("2024-05-31"),
        profileIndices: [2], // Valentina López (foodie)
      },
      {
        name: "Reto Fitness Mayo",
        description: "Campaña de promoción para el reto fitness de mayo",
        status: "COMPLETED" as const,
        budget: 3500000,
        clientIndex: 2,
        startDate: new Date("2024-05-01"),
        endDate: new Date("2024-05-31"),
        profileIndices: [1], // Carlos Rodríguez
      },
    ];

    for (const campaignData of campaignsData) {
      const client = createdClients[campaignData.clientIndex];
      if (!client || !client.contactId) continue;

      const existingCampaign = await prisma.campaign.findFirst({
        where: { name: campaignData.name, clientId: client.id },
      });

      if (existingCampaign) {
        console.log(`Campaign already exists: ${campaignData.name}`);
        continue;
      }

      const campaign = await prisma.campaign.create({
        data: {
          name: campaignData.name,
          description: campaignData.description,
          status: campaignData.status,
          budget: campaignData.budget,
          currency: "COP",
          startDate: campaignData.startDate,
          endDate: campaignData.endDate,
          clientId: client.id,
          clientContactId: client.contactId,
          createdById: adminUser.id,
          activatedAt: campaignData.status === "ACTIVE" || campaignData.status === "COMPLETED"
            ? campaignData.startDate
            : null,
        },
      });

      // Agregar perfiles a la campaña
      for (const profileIndex of campaignData.profileIndices) {
        const profile = createdProfiles[profileIndex];
        if (!profile) continue;

        const campaignProfile = await prisma.campaignProfile.create({
          data: {
            campaignId: campaign.id,
            profileId: profile.id,
            status: campaignData.status === "ACTIVE" || campaignData.status === "COMPLETED"
              ? "APPROVED"
              : "PENDING",
          },
        });

        // Obtener cuentas sociales del perfil con sus servicios
        const socialAccounts = await prisma.socialAccount.findMany({
          where: { profileId: profile.id },
          include: { services: true },
        });

        for (const account of socialAccounts) {
          const campaignPlatform = await prisma.campaignProfilePlatform.create({
            data: {
              campaignProfileId: campaignProfile.id,
              socialAccountId: account.id,
              status: campaignData.status === "ACTIVE" || campaignData.status === "COMPLETED"
                ? "APPROVED"
                : "PENDING",
            },
          });

          // Agregar primer servicio de cada cuenta
          if (account.services.length > 0) {
            const service = account.services[0];
            await prisma.campaignService.create({
              data: {
                campaignProfilePlatformId: campaignPlatform.id,
                profileServiceId: service.id,
                quantity: 1,
                basePrice: service.price,
                currency: "COP",
              },
            });
          }
        }
      }

      console.log(`Campaign created: ${campaign.name}`);
    }
  }

  console.log("\nSeeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
