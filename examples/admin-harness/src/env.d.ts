declare namespace App {
	interface Locals {
		adminUser?: {
			email: string;
			isAdmin: boolean;
			name: string;
		};
		csrfToken?: string;
	}
}
