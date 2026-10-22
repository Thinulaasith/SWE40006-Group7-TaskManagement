import { test, expect } from '@playwright/test';

// Runs against a live local Docker stack. Uses unique task titles and deletes its test data.
test('create, search, complete, edit and delete a task', async ({ page, request }) => {
  const title = `E2E Task ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const edited = `${title} updated`;
  let taskId;
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Task dashboard/i })).toBeVisible();
    await page.getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('What needs to get done?').fill(title);
    await dialog.getByRole('button', { name: 'Create task' }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    const listing = await request.get('/api/tasks');
    expect(listing.ok()).toBeTruthy();
    taskId = (await listing.json()).find(t => t.title === title)?.id;
    expect(taskId).toBeTruthy();

    await page.getByRole('textbox', { name: 'Search tasks' }).fill(title);
    const card = page.locator('.task-card', { has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(card).toBeVisible();
    await card.getByTitle('Mark as completed').click();
    await page.getByRole('button', { name: 'Completed', exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'All tasks' }).click();

    await page.getByRole('button', { name: `Edit ${title}` }).click();
    await page.getByRole('dialog').getByPlaceholder('What needs to get done?').fill(edited);
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await page.getByRole('textbox', { name: 'Search tasks' }).fill(edited);
    await expect(page.getByRole('heading', { name: edited, exact: true })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: `Delete ${edited}` }).click();
    await expect(page.getByRole('heading', { name: edited, exact: true })).toHaveCount(0);
    taskId = undefined;
  } finally {
    // Cleanup even if an assertion fails. Does not delete pre-existing user data.
    if (taskId) await request.delete(`/api/tasks/${taskId}`).catch(() => {});
  }
});
