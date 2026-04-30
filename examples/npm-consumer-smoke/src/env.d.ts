declare namespace App {
	interface Locals {
		adminUser?: {
			id: string;
			email: string;
			isAdmin: boolean;
			name: string;
		};
		csrfToken?: string;
	}
}
