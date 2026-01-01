import test from 'ava';
import { PostgresService } from '../src/adapters/postgres-service.js';
import { SheetsService } from '../src/adapters/sheets-service.js';
import { HttpClient } from '../src/adapters/http-client.js';
import { ArcGISService } from '../src/adapters/arcgis-service.js';
import { GitHubService } from '../src/adapters/github-service.js';
import { Octokit } from '@octokit/rest';

test('PostgresService is instantiable', (t) => {
  const service = new PostgresService();
  t.truthy(service);
  t.is(typeof service.tableExists, 'function');
  t.is(typeof service.query, 'function');
  t.is(typeof service.getTableMetadata, 'function');
});

test('SheetsService is instantiable', (t) => {
  const service = new SheetsService();
  t.truthy(service);
  t.is(typeof service.validateSgidIndexId, 'function');
  t.is(typeof service.clearCache, 'function');
  t.is(typeof service.getAllRows, 'function');
});

test('HttpClient is instantiable', (t) => {
  const client = new HttpClient();
  t.truthy(client);
  t.is(typeof client.head, 'function');
  t.is(typeof client.get, 'function');
  t.is(typeof client.getRaw, 'function');
});

test('ArcGISService is instantiable', (t) => {
  const service = new ArcGISService();
  t.truthy(service);
  t.is(typeof service.getItemDetails, 'function');
  t.is(typeof service.getItemGroups, 'function');
  t.is(typeof service.isItemPublic, 'function');
  t.is(typeof service.validateItem, 'function');
});

test('ArcGISService.getItemUrl generates correct URL', (t) => {
  const service = new ArcGISService();
  const url = service.getItemUrl('abc123def456');
  t.is(url, 'https://www.arcgis.com/home/item.html?id=abc123def456');
});

test('GitHubService is instantiable', (t) => {
  const octokit = new Octokit();
  const service = new GitHubService(octokit, 'owner', 'repo');
  t.truthy(service);
  t.is(typeof service.createComment, 'function');
  t.is(typeof service.updateComment, 'function');
  t.is(typeof service.getComment, 'function');
  t.is(typeof service.findBotComment, 'function');
  t.is(typeof service.addLabels, 'function');
  t.is(typeof service.removeLabel, 'function');
  t.is(typeof service.getLabels, 'function');
  t.is(typeof service.createIssue, 'function');
  t.is(typeof service.closeIssue, 'function');
  t.is(typeof service.searchIssues, 'function');
  t.is(typeof service.createLabels, 'function');
});

test('HttpClient throws errors with proper context', async (t) => {
  const client = new HttpClient();
  
  // Test with invalid URL
  const error = await t.throwsAsync(
    () => client.head('https://this-domain-definitely-does-not-exist-12345.com'),
    { instanceOf: Error }
  );
  
  t.truthy(error);
});
