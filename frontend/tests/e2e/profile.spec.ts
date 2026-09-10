import { test, expect, type Page } from '@playwright/test'

async function accountFixture(page: Page, verified = true) {
  const id = '81000000-0000-4000-8000-000000000001', now = new Date().toISOString()
  const user = { id, email: 'profile@example.com', aud: 'authenticated', role: 'authenticated', email_confirmed_at: now, app_metadata: { provider: 'email' }, user_metadata: {} }
  const exp = Math.floor(Date.now()/1000)+3600
  const access_token = [{alg:'HS256',typ:'JWT'},{sub:id,aud:'authenticated',role:'authenticated',exp},'fixture'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.')
  const session = {access_token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:exp,token_type:'bearer',user}
  const account = { id,user_id:id,full_name:'Yasmine El Amrani',username:'yasmine',student_id:'S123',role:'student',access_status:verified?'approved':'pending',status:verified?'approved':'pending',identity_status:verified?'verified':'pending',email_kind:'personal',can_use_sports:verified,needs_identity_action:!verified,created_at:now,updated_at:now }
  const saves: unknown[] = [], emails: unknown[] = [], errors: string[] = [], unhandled: string[] = []
  let fail = true
  page.on('pageerror', e=>errors.push(e.message))
  await page.route('**/*.supabase.co/**', async route=>{
    const req=route.request(), url=new URL(req.url()), key=url.pathname.split('/').at(-1)
    const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
    if(key==='token') return json(session)
    if(key==='user') {
      if(req.method()==='PUT') { emails.push(req.postDataJSON()); return json({...user,new_email:req.postDataJSON().email}) }
      return json(user)
    }
    if(key==='logout') return route.fulfill({status:204})
    if(['get_my_account_state','get_my_session_context'].includes(key!)) return json([account])
    if(key==='profiles') return json(account)
    if(['pitches','announcements','announcement_dismissals','get_next_booking','list_my_bookings'].includes(key!)) return json([])
    if(key==='update_my_profile') {
      saves.push(req.postDataJSON())
      if(fail) return json({code:'P0001',message:'username_taken'},400)
      account.full_name=req.postDataJSON().p_full_name; account.username=req.postDataJSON().p_username
      return json(account)
    }
    unhandled.push(req.method()+' '+key); return json({message:'Unhandled fixture'},400)
  })
  await page.goto('/login')
  await page.getByLabel('Email address',{exact:true}).fill(user.email)
  await page.getByLabel('Password',{exact:true}).fill('Fixture123!')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Play today'})).toBeVisible()
  await page.goto('/profile')
  await expect(page.getByRole('heading',{name:account.full_name})).toBeVisible()
  return {account,saves,emails,errors,unhandled,allowSave:()=>{fail=false}}
}

test('profile details preserve failed input and verified ID; email waits for confirmation',async({page})=>{
  const f=await accountFixture(page)
  await expect(page.getByRole('button',{name:'Edit Student ID'})).toHaveCount(0)
  await page.getByRole('button',{name:'Edit profile',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Edit profile'})
  await dialog.getByLabel('Full name',{exact:true}).fill('Updated Student')
  await dialog.getByLabel('Username',{exact:true}).fill('New_Student')
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await expect(dialog.getByRole('alert')).toContainText('That username is taken')
  await expect(dialog.getByLabel('Full name',{exact:true})).toHaveValue('Updated Student')
  f.allowSave()
  await dialog.getByRole('button',{name:'Save',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('heading',{name:'Updated Student'})).toBeVisible()
  expect(f.saves).toEqual([{p_full_name:'Updated Student',p_username:'new_student'},{p_full_name:'Updated Student',p_username:'new_student'}])
  expect(f.account.student_id).toBe('S123')
  await page.getByRole('button',{name:'Change email',exact:true}).click()
  const email=page.getByRole('dialog',{name:'Change email'})
  await email.getByLabel('New email',{exact:true}).fill('new@example.com')
  await email.getByRole('button',{name:'Send confirmation'}).click()
  await expect(email).not.toBeVisible()
  await expect(page.getByText('Waiting for confirmation:',{exact:false})).toContainText('new@example.com')
  expect(f.emails).toEqual([expect.objectContaining({email:'new@example.com',code_challenge_method:'s256'})])
  await page.screenshot({path:test.info().outputPath('profile.png'),fullPage:true})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(f.errors).toEqual([]);expect(f.unhandled).toEqual([])
})

test('pending profile sends ID corrections through verification',async({page})=>{
  const f=await accountFixture(page,false)
  await expect(page.getByRole('button',{name:'Edit Student ID'})).toHaveCount(0)
  await page.getByRole('link',{name:'View verification',exact:true}).click()
  await expect(page.getByRole('heading',{name:'ID under review'})).toBeVisible()
  await expect(page.getByLabel('Student ID',{exact:true})).toHaveValue('S123')
  expect(f.errors).toEqual([]);expect(f.unhandled).toEqual([])
})

test('email-change first confirmation uses correct OTP type and waits for other inbox',async({page})=>{
  const types: string[]=[]
  await page.route('**/*.supabase.co/auth/v1/verify',async route=>{
    types.push(route.request().postDataJSON().type)
    await route.fulfill({contentType:'application/json',body:JSON.stringify({user:null,session:null})})
  })
  await page.goto('/verify-email?token_hash=fixture-email-change&type=email_change')
  await expect(page.getByRole('heading',{name:'Confirm your other email'})).toBeVisible()
  expect(types).toEqual(['email_change'])
  expect(new URL(page.url()).search).toBe('')
  await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Send a new link',exact:true})).toHaveCount(0)
})

test('confirmation rejects wrong-flow tokens before contacting Auth',async({page})=>{
  let calls=0
  await page.route('**/*.supabase.co/auth/v1/verify',async route=>{calls++;await route.abort()})
  await page.goto('/verify-email?token_hash=fixture-recovery&type=recovery')
  await expect(page.getByRole('heading',{name:'Link not confirmed'})).toBeVisible()
  expect(calls).toBe(0)
})
