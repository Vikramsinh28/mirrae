import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Lets a merchant see what shoppers will see, on their own product, before the code goes on the website. */
export function TestTryOnCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>See it on your own product</CardTitle>
        <CardDescription>
          Upload a photo of yourself and one of your product photos to see exactly what a shopper gets. It uses your credits
          the same way a shopper&apos;s try-on does.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="sm" variant="outline">
          <Link href="/app/try">Try it on a product</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
