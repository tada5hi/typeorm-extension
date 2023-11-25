import{_ as s,o as n,c as a,Q as l}from"./chunks/framework.c93772cc.js";const d=JSON.parse('{"title":"Query","description":"","frontmatter":{},"headers":[],"relativePath":"guide/query.md","filePath":"guide/query.md"}'),p={name:"guide/query.md"},o=l(`<h1 id="query" tabindex="-1">Query <a class="header-anchor" href="#query" aria-label="Permalink to &quot;Query&quot;">​</a></h1><p>The query submodule enables query parameter (fields, filter, ...) values to be build, parsed &amp; validated. Therefore, the <a href="https://www.npmjs.com/package/rapiq" target="_blank" rel="noreferrer">rapiq</a> library is used under the hood.</p><p>The query parameter options (allowed, default, ...) are fully typed 🔥 and depend on the (nested-) properties of the target entity passed to the typeorm query builder.</p><div class="info custom-block"><p class="custom-block-title">Info</p><p>For more details, get in touch with the rapiq <a href="https://rapiq.tada5hi.net/" target="_blank" rel="noreferrer">documentation</a>.</p></div><h2 id="entities" tabindex="-1">Entities <a class="header-anchor" href="#entities" aria-label="Permalink to &quot;Entities&quot;">​</a></h2><p>For explanation proposes, two simple entities with a relation between them are declared to demonstrate the usage of the query utils:</p><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    Entity,</span></span>
<span class="line"><span style="color:#E1E4E8;">    PrimaryGeneratedColumn,</span></span>
<span class="line"><span style="color:#E1E4E8;">    Column,</span></span>
<span class="line"><span style="color:#E1E4E8;">    OneToOne,</span></span>
<span class="line"><span style="color:#E1E4E8;">    JoinColumn</span></span>
<span class="line"><span style="color:#E1E4E8;">} </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;typeorm&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">@</span><span style="color:#B392F0;">Entity</span><span style="color:#E1E4E8;">()</span></span>
<span class="line"><span style="color:#F97583;">export</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">class</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">User</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">PrimaryGeneratedColumn</span><span style="color:#E1E4E8;">({unsigned: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">id</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">number</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">Column</span><span style="color:#E1E4E8;">({type: </span><span style="color:#9ECBFF;">&#39;varchar&#39;</span><span style="color:#E1E4E8;">, length: </span><span style="color:#79B8FF;">30</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">Index</span><span style="color:#E1E4E8;">({unique: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">name</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">string</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">Column</span><span style="color:#E1E4E8;">({type: </span><span style="color:#9ECBFF;">&#39;varchar&#39;</span><span style="color:#E1E4E8;">, length: </span><span style="color:#79B8FF;">255</span><span style="color:#E1E4E8;">, default: </span><span style="color:#79B8FF;">null</span><span style="color:#E1E4E8;">, nullable: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">email</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">string</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">OneToOne</span><span style="color:#E1E4E8;">(() </span><span style="color:#F97583;">=&gt;</span><span style="color:#E1E4E8;"> Profile)</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">profile</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Profile</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">@</span><span style="color:#B392F0;">Entity</span><span style="color:#E1E4E8;">()</span></span>
<span class="line"><span style="color:#F97583;">export</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">class</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Profile</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">PrimaryGeneratedColumn</span><span style="color:#E1E4E8;">({unsigned: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">id</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">number</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">Column</span><span style="color:#E1E4E8;">({type: </span><span style="color:#9ECBFF;">&#39;varchar&#39;</span><span style="color:#E1E4E8;">, length: </span><span style="color:#79B8FF;">255</span><span style="color:#E1E4E8;">, default: </span><span style="color:#79B8FF;">null</span><span style="color:#E1E4E8;">, nullable: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">avatar</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">string</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">Column</span><span style="color:#E1E4E8;">({type: </span><span style="color:#9ECBFF;">&#39;varchar&#39;</span><span style="color:#E1E4E8;">, length: </span><span style="color:#79B8FF;">255</span><span style="color:#E1E4E8;">, default: </span><span style="color:#79B8FF;">null</span><span style="color:#E1E4E8;">, nullable: </span><span style="color:#79B8FF;">true</span><span style="color:#E1E4E8;">})</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">cover</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">string</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">OneToOne</span><span style="color:#E1E4E8;">(() </span><span style="color:#F97583;">=&gt;</span><span style="color:#E1E4E8;"> User)</span></span>
<span class="line"><span style="color:#E1E4E8;">    @</span><span style="color:#B392F0;">JoinColumn</span><span style="color:#E1E4E8;">()</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#FFAB70;">user</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">User</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#E1E4E8;">}</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    Entity,</span></span>
<span class="line"><span style="color:#24292E;">    PrimaryGeneratedColumn,</span></span>
<span class="line"><span style="color:#24292E;">    Column,</span></span>
<span class="line"><span style="color:#24292E;">    OneToOne,</span></span>
<span class="line"><span style="color:#24292E;">    JoinColumn</span></span>
<span class="line"><span style="color:#24292E;">} </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;typeorm&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">@</span><span style="color:#6F42C1;">Entity</span><span style="color:#24292E;">()</span></span>
<span class="line"><span style="color:#D73A49;">export</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">class</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">User</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">PrimaryGeneratedColumn</span><span style="color:#24292E;">({unsigned: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">id</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">number</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">Column</span><span style="color:#24292E;">({type: </span><span style="color:#032F62;">&#39;varchar&#39;</span><span style="color:#24292E;">, length: </span><span style="color:#005CC5;">30</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">Index</span><span style="color:#24292E;">({unique: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">name</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">string</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">Column</span><span style="color:#24292E;">({type: </span><span style="color:#032F62;">&#39;varchar&#39;</span><span style="color:#24292E;">, length: </span><span style="color:#005CC5;">255</span><span style="color:#24292E;">, default: </span><span style="color:#005CC5;">null</span><span style="color:#24292E;">, nullable: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">email</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">string</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">OneToOne</span><span style="color:#24292E;">(() </span><span style="color:#D73A49;">=&gt;</span><span style="color:#24292E;"> Profile)</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">profile</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Profile</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#24292E;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">@</span><span style="color:#6F42C1;">Entity</span><span style="color:#24292E;">()</span></span>
<span class="line"><span style="color:#D73A49;">export</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">class</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Profile</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">PrimaryGeneratedColumn</span><span style="color:#24292E;">({unsigned: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">id</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">number</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">Column</span><span style="color:#24292E;">({type: </span><span style="color:#032F62;">&#39;varchar&#39;</span><span style="color:#24292E;">, length: </span><span style="color:#005CC5;">255</span><span style="color:#24292E;">, default: </span><span style="color:#005CC5;">null</span><span style="color:#24292E;">, nullable: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">avatar</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">string</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">Column</span><span style="color:#24292E;">({type: </span><span style="color:#032F62;">&#39;varchar&#39;</span><span style="color:#24292E;">, length: </span><span style="color:#005CC5;">255</span><span style="color:#24292E;">, default: </span><span style="color:#005CC5;">null</span><span style="color:#24292E;">, nullable: </span><span style="color:#005CC5;">true</span><span style="color:#24292E;">})</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">cover</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">string</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">OneToOne</span><span style="color:#24292E;">(() </span><span style="color:#D73A49;">=&gt;</span><span style="color:#24292E;"> User)</span></span>
<span class="line"><span style="color:#24292E;">    @</span><span style="color:#6F42C1;">JoinColumn</span><span style="color:#24292E;">()</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#E36209;">user</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">User</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#24292E;">}</span></span></code></pre></div><h2 id="http" tabindex="-1">HTTP <a class="header-anchor" href="#http" aria-label="Permalink to &quot;HTTP&quot;">​</a></h2><p>In the following, two routing frameworks are used to demonstrate how incoming http requests are processed and can be used in combination with <a href="https://www.npmjs.com/package/rapiq" target="_blank" rel="noreferrer">rapiq</a> and this library.</p><h3 id="routup" tabindex="-1">Routup <a class="header-anchor" href="#routup" aria-label="Permalink to &quot;Routup&quot;">​</a></h3><p>In this example <a href="https://www.npmjs.com/package/routup" target="_blank" rel="noreferrer">routup</a> and the plugin <a href="https://www.npmjs.com/package/@routup/query" target="_blank" rel="noreferrer">@routup/query</a> is used to handle HTTP requests.</p><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> { createServer } </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;node:http&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">type</span><span style="color:#E1E4E8;"> { Request, Response } </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;routup&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> { createNodeDispatcher, Router } </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;routup&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> { createHandler, useQuery } </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;@routup/query&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    applyQuery,</span></span>
<span class="line"><span style="color:#E1E4E8;">    useDataSource</span></span>
<span class="line"><span style="color:#E1E4E8;">} </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;typeorm-extension&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">router</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">new</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Router</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"><span style="color:#E1E4E8;">router.</span><span style="color:#B392F0;">use</span><span style="color:#E1E4E8;">(</span><span style="color:#B392F0;">createHandler</span><span style="color:#E1E4E8;">());</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">/**</span></span>
<span class="line"><span style="color:#6A737D;"> * Get many users.</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Request example</span></span>
<span class="line"><span style="color:#6A737D;"> * - url: /users?page[limit]=10&amp;page[offset]=0&amp;include=profile&amp;filter[id]=1&amp;fields[user]=id,name</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Return Example:</span></span>
<span class="line"><span style="color:#6A737D;"> * {</span></span>
<span class="line"><span style="color:#6A737D;"> *     data: [</span></span>
<span class="line"><span style="color:#6A737D;"> *         {id: 1, name: &#39;tada5hi&#39;, profile: {avatar: &#39;avatar.jpg&#39;, cover: &#39;cover.jpg&#39;}}</span></span>
<span class="line"><span style="color:#6A737D;"> *      ],</span></span>
<span class="line"><span style="color:#6A737D;"> *     meta: {</span></span>
<span class="line"><span style="color:#6A737D;"> *        total: 1,</span></span>
<span class="line"><span style="color:#6A737D;"> *        limit: 20,</span></span>
<span class="line"><span style="color:#6A737D;"> *        offset: 0</span></span>
<span class="line"><span style="color:#6A737D;"> *    }</span></span>
<span class="line"><span style="color:#6A737D;"> * }</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#F97583;">@param</span><span style="color:#6A737D;"> </span><span style="color:#E1E4E8;">req</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#F97583;">@param</span><span style="color:#6A737D;"> </span><span style="color:#E1E4E8;">res</span></span>
<span class="line"><span style="color:#6A737D;"> */</span></span>
<span class="line"><span style="color:#E1E4E8;">router.</span><span style="color:#B392F0;">get</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&#39;users&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#F97583;">async</span><span style="color:#E1E4E8;"> (</span><span style="color:#FFAB70;">req</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Request</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">res</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Response</span><span style="color:#E1E4E8;">) </span><span style="color:#F97583;">=&gt;</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">dataSource</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">useDataSource</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">repository</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> dataSource.</span><span style="color:#B392F0;">getRepository</span><span style="color:#E1E4E8;">(User);</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">query</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> repository.</span><span style="color:#B392F0;">createQueryBuilder</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&#39;user&#39;</span><span style="color:#E1E4E8;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> { </span><span style="color:#79B8FF;">pagination</span><span style="color:#E1E4E8;"> } </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">applyQuery</span><span style="color:#E1E4E8;">(query, </span><span style="color:#B392F0;">useQuery</span><span style="color:#E1E4E8;">(req), {</span></span>
<span class="line"><span style="color:#E1E4E8;">        defaultAlias: </span><span style="color:#9ECBFF;">&#39;user&#39;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">        fields: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// porfile fields can only be included,</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.avatar&#39;</span><span style="color:#E1E4E8;">],</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        filters: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// porfile.id can only be used as a filter,</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">],</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        pagination: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// only allow to select 20 items at maximum.</span></span>
<span class="line"><span style="color:#E1E4E8;">            maxLimit: </span><span style="color:#79B8FF;">20</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        relations: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;profile&#39;</span><span style="color:#E1E4E8;">]</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        sort: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// profile.id can only be used as sorting key, </span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">]</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">    });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> [</span><span style="color:#79B8FF;">entities</span><span style="color:#E1E4E8;">, </span><span style="color:#79B8FF;">total</span><span style="color:#E1E4E8;">] </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> query.</span><span style="color:#B392F0;">getManyAndCount</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">return</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">        data: entities,</span></span>
<span class="line"><span style="color:#E1E4E8;">        meta: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            total,</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#F97583;">...</span><span style="color:#E1E4E8;">pagination</span></span>
<span class="line"><span style="color:#E1E4E8;">        }</span></span>
<span class="line"><span style="color:#E1E4E8;">    };</span></span>
<span class="line"><span style="color:#E1E4E8;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">server</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">createServer</span><span style="color:#E1E4E8;">(</span><span style="color:#B392F0;">createNodeDispatcher</span><span style="color:#E1E4E8;">(router));</span></span>
<span class="line"><span style="color:#E1E4E8;">server.</span><span style="color:#B392F0;">listen</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">80</span><span style="color:#E1E4E8;">);</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> { createServer } </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;node:http&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">type</span><span style="color:#24292E;"> { Request, Response } </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;routup&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> { createNodeDispatcher, Router } </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;routup&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> { createHandler, useQuery } </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;@routup/query&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    applyQuery,</span></span>
<span class="line"><span style="color:#24292E;">    useDataSource</span></span>
<span class="line"><span style="color:#24292E;">} </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;typeorm-extension&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">router</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">new</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Router</span><span style="color:#24292E;">();</span></span>
<span class="line"><span style="color:#24292E;">router.</span><span style="color:#6F42C1;">use</span><span style="color:#24292E;">(</span><span style="color:#6F42C1;">createHandler</span><span style="color:#24292E;">());</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">/**</span></span>
<span class="line"><span style="color:#6A737D;"> * Get many users.</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Request example</span></span>
<span class="line"><span style="color:#6A737D;"> * - url: /users?page[limit]=10&amp;page[offset]=0&amp;include=profile&amp;filter[id]=1&amp;fields[user]=id,name</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Return Example:</span></span>
<span class="line"><span style="color:#6A737D;"> * {</span></span>
<span class="line"><span style="color:#6A737D;"> *     data: [</span></span>
<span class="line"><span style="color:#6A737D;"> *         {id: 1, name: &#39;tada5hi&#39;, profile: {avatar: &#39;avatar.jpg&#39;, cover: &#39;cover.jpg&#39;}}</span></span>
<span class="line"><span style="color:#6A737D;"> *      ],</span></span>
<span class="line"><span style="color:#6A737D;"> *     meta: {</span></span>
<span class="line"><span style="color:#6A737D;"> *        total: 1,</span></span>
<span class="line"><span style="color:#6A737D;"> *        limit: 20,</span></span>
<span class="line"><span style="color:#6A737D;"> *        offset: 0</span></span>
<span class="line"><span style="color:#6A737D;"> *    }</span></span>
<span class="line"><span style="color:#6A737D;"> * }</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#D73A49;">@param</span><span style="color:#6A737D;"> </span><span style="color:#24292E;">req</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#D73A49;">@param</span><span style="color:#6A737D;"> </span><span style="color:#24292E;">res</span></span>
<span class="line"><span style="color:#6A737D;"> */</span></span>
<span class="line"><span style="color:#24292E;">router.</span><span style="color:#6F42C1;">get</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&#39;users&#39;</span><span style="color:#24292E;">, </span><span style="color:#D73A49;">async</span><span style="color:#24292E;"> (</span><span style="color:#E36209;">req</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Request</span><span style="color:#24292E;">, </span><span style="color:#E36209;">res</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Response</span><span style="color:#24292E;">) </span><span style="color:#D73A49;">=&gt;</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">dataSource</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">useDataSource</span><span style="color:#24292E;">();</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">repository</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> dataSource.</span><span style="color:#6F42C1;">getRepository</span><span style="color:#24292E;">(User);</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">query</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> repository.</span><span style="color:#6F42C1;">createQueryBuilder</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&#39;user&#39;</span><span style="color:#24292E;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> { </span><span style="color:#005CC5;">pagination</span><span style="color:#24292E;"> } </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">applyQuery</span><span style="color:#24292E;">(query, </span><span style="color:#6F42C1;">useQuery</span><span style="color:#24292E;">(req), {</span></span>
<span class="line"><span style="color:#24292E;">        defaultAlias: </span><span style="color:#032F62;">&#39;user&#39;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">        fields: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// porfile fields can only be included,</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.avatar&#39;</span><span style="color:#24292E;">],</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        filters: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// porfile.id can only be used as a filter,</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">],</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        pagination: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// only allow to select 20 items at maximum.</span></span>
<span class="line"><span style="color:#24292E;">            maxLimit: </span><span style="color:#005CC5;">20</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        relations: {</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;profile&#39;</span><span style="color:#24292E;">]</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        sort: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// profile.id can only be used as sorting key, </span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">]</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">    });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> [</span><span style="color:#005CC5;">entities</span><span style="color:#24292E;">, </span><span style="color:#005CC5;">total</span><span style="color:#24292E;">] </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> query.</span><span style="color:#6F42C1;">getManyAndCount</span><span style="color:#24292E;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">return</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">        data: entities,</span></span>
<span class="line"><span style="color:#24292E;">        meta: {</span></span>
<span class="line"><span style="color:#24292E;">            total,</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#D73A49;">...</span><span style="color:#24292E;">pagination</span></span>
<span class="line"><span style="color:#24292E;">        }</span></span>
<span class="line"><span style="color:#24292E;">    };</span></span>
<span class="line"><span style="color:#24292E;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">server</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">createServer</span><span style="color:#24292E;">(</span><span style="color:#6F42C1;">createNodeDispatcher</span><span style="color:#24292E;">(router));</span></span>
<span class="line"><span style="color:#24292E;">server.</span><span style="color:#6F42C1;">listen</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">80</span><span style="color:#24292E;">);</span></span></code></pre></div><h3 id="express" tabindex="-1">Express <a class="header-anchor" href="#express" aria-label="Permalink to &quot;Express&quot;">​</a></h3><p>In this example <a href="https://www.npmjs.com/package/express" target="_blank" rel="noreferrer">express</a> is used to handle HTTP requests.</p><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki github-dark vp-code-dark"><code><span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">type</span><span style="color:#E1E4E8;"> { Request, Response } </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;express&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> express </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;express&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">import</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    applyQuery,</span></span>
<span class="line"><span style="color:#E1E4E8;">    useDataSource</span></span>
<span class="line"><span style="color:#E1E4E8;">} </span><span style="color:#F97583;">from</span><span style="color:#E1E4E8;"> </span><span style="color:#9ECBFF;">&#39;typeorm-extension&#39;</span><span style="color:#E1E4E8;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">app</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">express</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">/**</span></span>
<span class="line"><span style="color:#6A737D;"> * Get many users.</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Request example</span></span>
<span class="line"><span style="color:#6A737D;"> * - url: /users?page[limit]=10&amp;page[offset]=0&amp;include=profile&amp;filter[id]=1&amp;fields[user]=id,name</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Return Example:</span></span>
<span class="line"><span style="color:#6A737D;"> * {</span></span>
<span class="line"><span style="color:#6A737D;"> *     data: [</span></span>
<span class="line"><span style="color:#6A737D;"> *         {id: 1, name: &#39;tada5hi&#39;, profile: {avatar: &#39;avatar.jpg&#39;, cover: &#39;cover.jpg&#39;}}</span></span>
<span class="line"><span style="color:#6A737D;"> *      ],</span></span>
<span class="line"><span style="color:#6A737D;"> *     meta: {</span></span>
<span class="line"><span style="color:#6A737D;"> *        total: 1,</span></span>
<span class="line"><span style="color:#6A737D;"> *        limit: 20,</span></span>
<span class="line"><span style="color:#6A737D;"> *        offset: 0</span></span>
<span class="line"><span style="color:#6A737D;"> *    }</span></span>
<span class="line"><span style="color:#6A737D;"> * }</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#F97583;">@param</span><span style="color:#6A737D;"> </span><span style="color:#E1E4E8;">req</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#F97583;">@param</span><span style="color:#6A737D;"> </span><span style="color:#E1E4E8;">res</span></span>
<span class="line"><span style="color:#6A737D;"> */</span></span>
<span class="line"><span style="color:#E1E4E8;">app.</span><span style="color:#B392F0;">get</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&#39;users&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#F97583;">async</span><span style="color:#E1E4E8;"> (</span><span style="color:#FFAB70;">req</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Request</span><span style="color:#E1E4E8;">, </span><span style="color:#FFAB70;">res</span><span style="color:#F97583;">:</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">Response</span><span style="color:#E1E4E8;">) </span><span style="color:#F97583;">=&gt;</span><span style="color:#E1E4E8;"> {</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">dataSource</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">useDataSource</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">repository</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> dataSource.</span><span style="color:#B392F0;">getRepository</span><span style="color:#E1E4E8;">(User);</span></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> </span><span style="color:#79B8FF;">query</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> repository.</span><span style="color:#B392F0;">createQueryBuilder</span><span style="color:#E1E4E8;">(</span><span style="color:#9ECBFF;">&#39;user&#39;</span><span style="color:#E1E4E8;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> { </span><span style="color:#79B8FF;">pagination</span><span style="color:#E1E4E8;"> } </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#B392F0;">applyQuery</span><span style="color:#E1E4E8;">(query, req.query, {</span></span>
<span class="line"><span style="color:#E1E4E8;">        defaultAlias: </span><span style="color:#9ECBFF;">&#39;user&#39;</span><span style="color:#E1E4E8;">,</span></span>
<span class="line"><span style="color:#E1E4E8;">        fields: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// porfile fields can only be included,</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.avatar&#39;</span><span style="color:#E1E4E8;">],</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        filters: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// porfile.id can only be used as a filter,</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">],</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        pagination: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// only allow to select 20 items at maximum.</span></span>
<span class="line"><span style="color:#E1E4E8;">            maxLimit: </span><span style="color:#79B8FF;">20</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        relations: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;profile&#39;</span><span style="color:#E1E4E8;">]</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">        sort: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// profile.id can only be used as sorting key, </span></span>
<span class="line"><span style="color:#E1E4E8;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#E1E4E8;">            allowed: [</span><span style="color:#9ECBFF;">&#39;id&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;name&#39;</span><span style="color:#E1E4E8;">, </span><span style="color:#9ECBFF;">&#39;profile.id&#39;</span><span style="color:#E1E4E8;">]</span></span>
<span class="line"><span style="color:#E1E4E8;">        },</span></span>
<span class="line"><span style="color:#E1E4E8;">    });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">const</span><span style="color:#E1E4E8;"> [</span><span style="color:#79B8FF;">entities</span><span style="color:#E1E4E8;">, </span><span style="color:#79B8FF;">total</span><span style="color:#E1E4E8;">] </span><span style="color:#F97583;">=</span><span style="color:#E1E4E8;"> </span><span style="color:#F97583;">await</span><span style="color:#E1E4E8;"> query.</span><span style="color:#B392F0;">getManyAndCount</span><span style="color:#E1E4E8;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">    </span><span style="color:#F97583;">return</span><span style="color:#E1E4E8;"> res.</span><span style="color:#B392F0;">json</span><span style="color:#E1E4E8;">({</span></span>
<span class="line"><span style="color:#E1E4E8;">        data: {</span></span>
<span class="line"><span style="color:#E1E4E8;">            data: entities,</span></span>
<span class="line"><span style="color:#E1E4E8;">            meta: {</span></span>
<span class="line"><span style="color:#E1E4E8;">                total,</span></span>
<span class="line"><span style="color:#E1E4E8;">                </span><span style="color:#F97583;">...</span><span style="color:#E1E4E8;">pagination</span></span>
<span class="line"><span style="color:#E1E4E8;">            }</span></span>
<span class="line"><span style="color:#E1E4E8;">        }</span></span>
<span class="line"><span style="color:#E1E4E8;">    });</span></span>
<span class="line"><span style="color:#E1E4E8;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#E1E4E8;">app.</span><span style="color:#B392F0;">listen</span><span style="color:#E1E4E8;">(</span><span style="color:#79B8FF;">80</span><span style="color:#E1E4E8;">);</span></span></code></pre><pre class="shiki github-light vp-code-light"><code><span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">type</span><span style="color:#24292E;"> { Request, Response } </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;express&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> express </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;express&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">import</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    applyQuery,</span></span>
<span class="line"><span style="color:#24292E;">    useDataSource</span></span>
<span class="line"><span style="color:#24292E;">} </span><span style="color:#D73A49;">from</span><span style="color:#24292E;"> </span><span style="color:#032F62;">&#39;typeorm-extension&#39;</span><span style="color:#24292E;">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">app</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">express</span><span style="color:#24292E;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#6A737D;">/**</span></span>
<span class="line"><span style="color:#6A737D;"> * Get many users.</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Request example</span></span>
<span class="line"><span style="color:#6A737D;"> * - url: /users?page[limit]=10&amp;page[offset]=0&amp;include=profile&amp;filter[id]=1&amp;fields[user]=id,name</span></span>
<span class="line"><span style="color:#6A737D;"> *</span></span>
<span class="line"><span style="color:#6A737D;"> * Return Example:</span></span>
<span class="line"><span style="color:#6A737D;"> * {</span></span>
<span class="line"><span style="color:#6A737D;"> *     data: [</span></span>
<span class="line"><span style="color:#6A737D;"> *         {id: 1, name: &#39;tada5hi&#39;, profile: {avatar: &#39;avatar.jpg&#39;, cover: &#39;cover.jpg&#39;}}</span></span>
<span class="line"><span style="color:#6A737D;"> *      ],</span></span>
<span class="line"><span style="color:#6A737D;"> *     meta: {</span></span>
<span class="line"><span style="color:#6A737D;"> *        total: 1,</span></span>
<span class="line"><span style="color:#6A737D;"> *        limit: 20,</span></span>
<span class="line"><span style="color:#6A737D;"> *        offset: 0</span></span>
<span class="line"><span style="color:#6A737D;"> *    }</span></span>
<span class="line"><span style="color:#6A737D;"> * }</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#D73A49;">@param</span><span style="color:#6A737D;"> </span><span style="color:#24292E;">req</span></span>
<span class="line"><span style="color:#6A737D;"> * </span><span style="color:#D73A49;">@param</span><span style="color:#6A737D;"> </span><span style="color:#24292E;">res</span></span>
<span class="line"><span style="color:#6A737D;"> */</span></span>
<span class="line"><span style="color:#24292E;">app.</span><span style="color:#6F42C1;">get</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&#39;users&#39;</span><span style="color:#24292E;">, </span><span style="color:#D73A49;">async</span><span style="color:#24292E;"> (</span><span style="color:#E36209;">req</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Request</span><span style="color:#24292E;">, </span><span style="color:#E36209;">res</span><span style="color:#D73A49;">:</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">Response</span><span style="color:#24292E;">) </span><span style="color:#D73A49;">=&gt;</span><span style="color:#24292E;"> {</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">dataSource</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">useDataSource</span><span style="color:#24292E;">();</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">repository</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> dataSource.</span><span style="color:#6F42C1;">getRepository</span><span style="color:#24292E;">(User);</span></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> </span><span style="color:#005CC5;">query</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> repository.</span><span style="color:#6F42C1;">createQueryBuilder</span><span style="color:#24292E;">(</span><span style="color:#032F62;">&#39;user&#39;</span><span style="color:#24292E;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> { </span><span style="color:#005CC5;">pagination</span><span style="color:#24292E;"> } </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#6F42C1;">applyQuery</span><span style="color:#24292E;">(query, req.query, {</span></span>
<span class="line"><span style="color:#24292E;">        defaultAlias: </span><span style="color:#032F62;">&#39;user&#39;</span><span style="color:#24292E;">,</span></span>
<span class="line"><span style="color:#24292E;">        fields: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// porfile fields can only be included,</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.avatar&#39;</span><span style="color:#24292E;">],</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        filters: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// porfile.id can only be used as a filter,</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">],</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        pagination: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// only allow to select 20 items at maximum.</span></span>
<span class="line"><span style="color:#24292E;">            maxLimit: </span><span style="color:#005CC5;">20</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        relations: {</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;profile&#39;</span><span style="color:#24292E;">]</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">        sort: {</span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// profile.id can only be used as sorting key, </span></span>
<span class="line"><span style="color:#24292E;">            </span><span style="color:#6A737D;">// if the relation &#39;profile&#39; is included.</span></span>
<span class="line"><span style="color:#24292E;">            allowed: [</span><span style="color:#032F62;">&#39;id&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;name&#39;</span><span style="color:#24292E;">, </span><span style="color:#032F62;">&#39;profile.id&#39;</span><span style="color:#24292E;">]</span></span>
<span class="line"><span style="color:#24292E;">        },</span></span>
<span class="line"><span style="color:#24292E;">    });</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#6A737D;">// -----------------------------------------------------</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">const</span><span style="color:#24292E;"> [</span><span style="color:#005CC5;">entities</span><span style="color:#24292E;">, </span><span style="color:#005CC5;">total</span><span style="color:#24292E;">] </span><span style="color:#D73A49;">=</span><span style="color:#24292E;"> </span><span style="color:#D73A49;">await</span><span style="color:#24292E;"> query.</span><span style="color:#6F42C1;">getManyAndCount</span><span style="color:#24292E;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">    </span><span style="color:#D73A49;">return</span><span style="color:#24292E;"> res.</span><span style="color:#6F42C1;">json</span><span style="color:#24292E;">({</span></span>
<span class="line"><span style="color:#24292E;">        data: {</span></span>
<span class="line"><span style="color:#24292E;">            data: entities,</span></span>
<span class="line"><span style="color:#24292E;">            meta: {</span></span>
<span class="line"><span style="color:#24292E;">                total,</span></span>
<span class="line"><span style="color:#24292E;">                </span><span style="color:#D73A49;">...</span><span style="color:#24292E;">pagination</span></span>
<span class="line"><span style="color:#24292E;">            }</span></span>
<span class="line"><span style="color:#24292E;">        }</span></span>
<span class="line"><span style="color:#24292E;">    });</span></span>
<span class="line"><span style="color:#24292E;">});</span></span>
<span class="line"></span>
<span class="line"><span style="color:#24292E;">app.</span><span style="color:#6F42C1;">listen</span><span style="color:#24292E;">(</span><span style="color:#005CC5;">80</span><span style="color:#24292E;">);</span></span></code></pre></div>`,15),e=[o];function t(r,c,E,y,i,F){return n(),a("div",null,e)}const A=s(p,[["render",t]]);export{d as __pageData,A as default};
