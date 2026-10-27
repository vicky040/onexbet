import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:onexbet/data/api/api_client.dart';
import 'package:onexbet/data/api/api_exception.dart';
import 'package:onexbet/data/api/token_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The API client is the one piece of the app every screen depends on, so
/// its envelope handling, bearer header and token refresh are tested
/// directly against a scripted HTTP client.
void main() {
  const baseUrl = 'http://localhost:3000/api/v1';

  http.Response json(Object body, {int status = 200}) =>
      http.Response(jsonEncode(body), status, headers: {
        'content-type': 'application/json',
      });

  http.Response success(Object data) => json({'ok': true, 'data': data});

  http.Response failure(
    String code,
    String message, {
    int status = 400,
    List<Map<String, String>>? details,
  }) =>
      json({
        'ok': false,
        'error': {
          'code': code,
          'message': message,
          'details': ?details,
        },
      }, status: status);

  Future<({ApiClient client, TokenStore tokens, List<http.Request> sent})> make(
    Future<http.Response> Function(http.Request request, int callCount) handler, {
    String? accessToken,
    String? refreshToken,
  }) async {
    SharedPreferences.setMockInitialValues({
      'auth_access_token': ?accessToken,
      'auth_refresh_token': ?refreshToken,
    });

    final tokens = TokenStore();
    final sent = <http.Request>[];
    final client = ApiClient(
      baseUrl: baseUrl,
      tokens: tokens,
      httpClient: MockClient((request) async {
        sent.add(request);
        return handler(request, sent.length);
      }),
    );
    return (client: client, tokens: tokens, sent: sent);
  }

  test('unwraps the data envelope', () async {
    final h = await make((_, _) async => success({'totalBalance': 140474.93}));

    final data = await h.client.get('/wallet/summary');

    expect(data, {'totalBalance': 140474.93});
    expect(h.sent.single.url.toString(), '$baseUrl/wallet/summary');
  });

  test('sends the access token as a bearer header', () async {
    final h = await make(
      (_, _) async => success(const []),
      accessToken: 'access-1',
    );

    await h.client.get('/payins');

    expect(h.sent.single.headers['authorization'], 'Bearer access-1');
  });

  test('leaves the bearer header off an unauthenticated call', () async {
    final h = await make(
      (_, _) async => success({'accessToken': 'a', 'refreshToken': 'r'}),
      accessToken: 'access-1',
    );

    await h.client.post('/auth/login', body: {}, authenticated: false);

    expect(h.sent.single.headers.containsKey('authorization'), isFalse);
  });

  test('turns an error envelope into an ApiException', () async {
    final h = await make(
      (_, _) async => failure(
        'insufficient_balance',
        "This would take the agent's balance below zero",
        status: 409,
      ),
    );

    await expectLater(
      h.client.post('/deposits', body: {}),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', 'insufficient_balance')
            .having((e) => e.statusCode, 'statusCode', 409)
            .having(
              (e) => e.message,
              'message',
              "This would take the agent's balance below zero",
            ),
      ),
    );
  });

  test('keeps the per-field errors from a validation failure', () async {
    final h = await make(
      (_, _) async => failure(
        'validation_failed',
        'Some fields are invalid',
        status: 422,
        details: [
          {'field': 'mobile', 'message': 'Enter a valid 10-digit mobile number'},
        ],
      ),
    );

    try {
      await h.client.post('/auth/login', body: {}, authenticated: false);
      fail('expected an ApiException');
    } on ApiException catch (error) {
      expect(error.details.single.field, 'mobile');
      expect(
        error.details.single.message,
        'Enter a valid 10-digit mobile number',
      );
    }
  });

  test('refreshes once on a 401 and retries the original request', () async {
    final h = await make(
      (request, call) async {
        if (call == 1) return failure('unauthorized', 'expired', status: 401);
        if (request.url.path.endsWith('/auth/refresh')) {
          return success({
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
          });
        }
        return success({'totalBalance': 1});
      },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    );

    final data = await h.client.get('/wallet/summary');

    expect(data, {'totalBalance': 1});
    expect(h.sent.length, 3, reason: 'original, refresh, retry');
    expect(h.sent[1].url.path, endsWith('/auth/refresh'));
    // The retry carries the new token, and it is persisted.
    expect(h.sent[2].headers['authorization'], 'Bearer access-2');
    expect(await h.tokens.accessToken(), 'access-2');
  });

  test('a refused refresh clears the session and reports it', () async {
    var expiredCalls = 0;
    final h = await make(
      (request, _) async => request.url.path.endsWith('/auth/refresh')
          ? failure('unauthorized', 'This session has expired', status: 401)
          : failure('unauthorized', 'expired', status: 401),
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    );
    h.client.onSessionExpired = () => expiredCalls++;

    await expectLater(
      h.client.get('/wallet/summary'),
      throwsA(isA<ApiException>().having((e) => e.isUnauthorized, 'is 401', true)),
    );

    expect(expiredCalls, 1);
    expect(await h.tokens.accessToken(), isNull);
    expect(await h.tokens.refreshToken(), isNull);
    expect(await h.tokens.hasSession(), isFalse);
  });

  test('with nothing to refresh, it ends the session without a call', () async {
    var expiredCalls = 0;
    final h = await make(
      (_, _) async => failure('unauthorized', 'expired', status: 401),
      accessToken: 'access-1',
    );
    h.client.onSessionExpired = () => expiredCalls++;

    await expectLater(
      h.client.get('/wallet/summary'),
      throwsA(isA<ApiException>()),
    );

    expect(h.sent.length, 1, reason: 'no refresh token, so no refresh call');
    expect(expiredCalls, 1);
  });

  test('an unreachable server surfaces as a network error', () async {
    final h = await make(
      (_, _) async => throw http.ClientException('Connection refused'),
    );

    await expectLater(
      h.client.get('/wallet/summary'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.isNetwork, 'isNetwork', true)
            .having((e) => e.message, 'message', contains(baseUrl)),
      ),
    );
  });

  test('a flaky connection during refresh keeps the tokens', () async {
    var expiredCalls = 0;
    final h = await make(
      (request, _) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          throw http.ClientException('Connection reset');
        }
        return failure('unauthorized', 'expired', status: 401);
      },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    );
    h.client.onSessionExpired = () => expiredCalls++;

    await expectLater(h.client.get('/wallet/summary'), throwsA(isA<ApiException>()));

    // The agent is not signed out just because the network blipped.
    expect(await h.tokens.refreshToken(), 'refresh-1');
    expect(expiredCalls, 0);
  });

  test('a non-JSON body does not escape as a parse error', () async {
    final h = await make(
      (_, _) async => http.Response('<html>502 Bad Gateway</html>', 502),
    );

    await expectLater(
      h.client.get('/wallet/summary'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', 'server_error')
            .having((e) => e.statusCode, 'statusCode', 502),
      ),
    );
  });

  test('query parameters are appended', () async {
    final h = await make((_, _) async => success(const []));

    await h.client.get('/payouts/payments', query: {'status': 'PENDING'});

    expect(h.sent.single.url.queryParameters, {'status': 'PENDING'});
  });

  test('concurrent 401s trigger a single refresh', () async {
    var refreshCalls = 0;
    final h = await make(
      (request, _) async {
        if (request.url.path.endsWith('/auth/refresh')) {
          refreshCalls++;
          return success({
            'accessToken': 'access-2',
            'refreshToken': 'refresh-2',
          });
        }
        return request.headers['authorization'] == 'Bearer access-2'
            ? success(const [])
            : failure('unauthorized', 'expired', status: 401);
      },
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    );

    await Future.wait([
      h.client.get('/payins'),
      h.client.get('/deposits'),
      h.client.get('/notifications'),
    ]);

    expect(refreshCalls, 1);
  });
}
