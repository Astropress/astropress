Feature: Operator initiates a GitHub OAuth authorization-code flow

  # Phase 6 OAuth providers are registered with their authorize/token
  # URLs, scopes, and env keys. The start endpoint mints an HMAC-signed
  # state token and redirects to the IdP; the callback verifies the
  # state and exchanges the code for tokens.

  Scenario: Building the authorize redirect issues a state token that verifies under the same rootSecret
    Given a registered OAuth provider for the "deploy-hooks" domain
    When buildAuthorizeRedirect is called with a clientId and origin
    Then the returned URL targets the provider's authorizationUrl
    And verifyOAuthState accepts the issued state under the same rootSecret

  Scenario: A state token does not verify under a different rootSecret
    Given an issued state token signed with one rootSecret
    When verifyOAuthState is called with a different rootSecret
    Then verification fails with code "INVALID_SIGNATURE"

  Scenario: Token exchange returns the parsed access token on a 200 response
    Given a successful token-endpoint response with access_token
    When exchangeCodeForToken is called with the authorization code
    Then the result is ok with the parsed OAuthTokenSet

  Scenario: Token exchange returns TOKEN_HTTP_ERROR on a 4xx response
    Given a token endpoint that responds 401
    When exchangeCodeForToken is called
    Then the result is ok=false with code "TOKEN_HTTP_ERROR" and the upstream status
