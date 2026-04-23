import { expect, test } from "@playwright/test";

const apiBaseURL = process.env.E2E_API_URL ?? "http://localhost:4000";

const employee = {
  email: process.env.E2E_EMPLOYEE_EMAIL ?? "mitarbeiter@example.com",
  password: process.env.E2E_EMPLOYEE_PASSWORD ?? "Password123",
  companyCode: process.env.E2E_COMPANY_CODE ?? "FIRMA-XY"
};

const vendor = {
  email: process.env.E2E_VENDOR_EMAIL ?? "baecker@example.com",
  password: process.env.E2E_VENDOR_PASSWORD ?? "Password123"
};

const admin = {
  email: process.env.E2E_ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "Password123"
};

const company = {
  email: process.env.E2E_COMPANY_EMAIL ?? "firma@example.com",
  password: process.env.E2E_COMPANY_PASSWORD ?? "Password123",
  companyCode: process.env.E2E_COMPANY_CODE ?? "FIRMA-XY"
};

const loginAs = async (params: {
  request: import("@playwright/test").APIRequestContext;
  path: string;
  body: Record<string, unknown>;
}) => {
  const response = await params.request.post(`${apiBaseURL}${params.path}`, {
    data: params.body
  });
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    token?: string;
    vendorId?: string;
    companyId?: string;
  };
  expect(payload.token).toBeTruthy();
  return payload;
};

test("employee API login works and orders endpoint is reachable", async ({ request }) => {
  const loginResponse = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      email: employee.email,
      password: employee.password,
      companyCode: employee.companyCode
    }
  });

  expect(loginResponse.ok()).toBeTruthy();

  const loginBody = (await loginResponse.json()) as { token?: string };
  expect(loginBody.token).toBeTruthy();

  const ordersResponse = await request.get(`${apiBaseURL}/orders`, {
    headers: {
      Authorization: `Bearer ${loginBody.token}`
    }
  });

  expect(ordersResponse.ok()).toBeTruthy();
});

test("vendor API login works and vendor orders endpoint is reachable", async ({ request }) => {
  const loginResponse = await request.post(`${apiBaseURL}/auth/login`, {
    data: {
      email: vendor.email,
      password: vendor.password
    }
  });

  expect(loginResponse.ok()).toBeTruthy();

  const loginBody = (await loginResponse.json()) as { token?: string };
  expect(loginBody.token).toBeTruthy();

  const vendorOrdersResponse = await request.get(`${apiBaseURL}/orders/vendor`, {
    headers: {
      Authorization: `Bearer ${loginBody.token}`
    }
  });

  expect(vendorOrdersResponse.ok()).toBeTruthy();
});

test("baecker request -> admin approves -> employee can order", async ({ request }) => {
  const adminLogin = await loginAs({
    request,
    path: "/auth/admin/login",
    body: {
      email: admin.email,
      password: admin.password
    }
  });

  const companyLogin = await loginAs({
    request,
    path: "/auth/company/login",
    body: {
      email: company.email,
      password: company.password,
      companyCode: company.companyCode
    }
  });
  expect(companyLogin.companyId).toBeTruthy();

  const vendorLogin = await loginAs({
    request,
    path: "/auth/login",
    body: {
      email: vendor.email,
      password: vendor.password
    }
  });
  expect(vendorLogin.vendorId).toBeTruthy();

  const vendorId = vendorLogin.vendorId!;
  const companyId = companyLogin.companyId!;

  const cleanupLinkResponse = await request.delete(
    `${apiBaseURL}/admin/links/${vendorId}/${companyId}`,
    {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`
      }
    }
  );
  expect(cleanupLinkResponse.status()).toBe(204);

  const requestLinkResponse = await request.post(`${apiBaseURL}/vendor/companies`, {
    headers: {
      Authorization: `Bearer ${vendorLogin.token}`
    },
    data: {
      companyCode: company.companyCode
    }
  });
  expect([200, 201]).toContain(requestLinkResponse.status());
  const requestLinkBody = (await requestLinkResponse.json()) as {
    status?: "PENDING" | "APPROVED";
  };
  expect(requestLinkBody.status).toBe("PENDING");

  const pendingListResponse = await request.get(`${apiBaseURL}/admin/vendor-requests`, {
    headers: {
      Authorization: `Bearer ${adminLogin.token}`
    }
  });
  expect(pendingListResponse.ok()).toBeTruthy();
  const pendingList = (await pendingListResponse.json()) as Array<{
    vendorId: string;
    companyId: string;
    status: "PENDING" | "APPROVED";
  }>;
  const pendingItem = pendingList.find(
    (item) => item.vendorId === vendorId && item.companyId === companyId
  );
  expect(pendingItem).toBeTruthy();
  expect(pendingItem?.status).toBe("PENDING");

  const approveResponse = await request.post(
    `${apiBaseURL}/admin/vendor-requests/${vendorId}/${companyId}/approve`,
    {
      headers: {
        Authorization: `Bearer ${adminLogin.token}`
      }
    }
  );
  expect(approveResponse.ok()).toBeTruthy();
  const approveBody = (await approveResponse.json()) as { status?: "PENDING" | "APPROVED" };
  expect(approveBody.status).toBe("APPROVED");

  const employeeLogin = await loginAs({
    request,
    path: "/auth/login",
    body: {
      email: employee.email,
      password: employee.password,
      companyCode: employee.companyCode
    }
  });

  const companyVendorsResponse = await request.get(`${apiBaseURL}/vendors/company`, {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    }
  });
  expect(companyVendorsResponse.ok()).toBeTruthy();
  const companyVendors = (await companyVendorsResponse.json()) as Array<{ id: string }>;
  const employeeCanSeeVendor = companyVendors.some((item) => item.id === vendorId);
  expect(employeeCanSeeVendor).toBeTruthy();

  const vendorDetailsResponse = await request.get(`${apiBaseURL}/vendors/${vendorId}`, {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    }
  });
  expect(vendorDetailsResponse.ok()).toBeTruthy();
  const vendorDetails = (await vendorDetailsResponse.json()) as {
    id: string;
    products: Array<{ id: string; active?: boolean }>;
  };

  let productId = vendorDetails.products.find((item) => item.active !== false)?.id;
  if (!productId) {
    const createProductResponse = await request.post(`${apiBaseURL}/vendors/${vendorId}/products`, {
      headers: {
        Authorization: `Bearer ${vendorLogin.token}`
      },
      data: {
        name: `E2E Brot ${Date.now()}`,
        category: "BROT",
        price: 2.5,
        unit: "Stk",
        active: true
      }
    });
    expect(createProductResponse.ok()).toBeTruthy();
    const createdProduct = (await createProductResponse.json()) as { id: string };
    productId = createdProduct.id;
  }

  const createOrderResponse = await request.post(`${apiBaseURL}/orders`, {
    headers: {
      Authorization: `Bearer ${employeeLogin.token}`
    },
    data: {
      vendorId,
      pickupWindow: "11:30-12:00",
      note: "Playwright E2E Flow",
      items: [
        {
          productId,
          qty: 1
        }
      ]
    }
  });
  expect(createOrderResponse.status()).toBe(201);
  const orderBody = (await createOrderResponse.json()) as { id?: string };
  expect(orderBody.id).toBeTruthy();

  const today = new Date().toISOString().slice(0, 10);
  const vendorOrdersResponse = await request.get(
    `${apiBaseURL}/orders/vendor?period=week&date=${today}`,
    {
      headers: {
        Authorization: `Bearer ${vendorLogin.token}`
      }
    }
  );
  expect(vendorOrdersResponse.ok()).toBeTruthy();
  const vendorOrdersBody = (await vendorOrdersResponse.json()) as {
    orders?: Array<{ id: string }>;
  };
  const seenOrder = (vendorOrdersBody.orders ?? []).some((item) => item.id === orderBody.id);
  expect(seenOrder).toBeTruthy();
});
